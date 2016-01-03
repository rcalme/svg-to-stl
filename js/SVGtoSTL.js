// Removes all children from a three.js group
function clearGroup(group) {
    for (var i = group.children.length; i >= 0; i--) {
        group.remove(group.children[i]);
    }
}

// Takes an SVG string, and returns a scene to render as a 3D STL
function renderObject(paths, scene, group, options) {
    console.log("Rendering 3D object...");
    // Solid Color
    options.color = new THREE.Color( options.objectColor ); 
    options.material = (options.wantInvertedType) ?
        new THREE.MeshLambertMaterial({
          color: options.color,
          emissive: options.color,
        }) :
        new THREE.MeshLambertMaterial({
          color: options.color,
          emissive: options.color,
          side:THREE.DoubleSide});

    // Create an extrusion from the SVG path shapes
    var svgMesh = getExtrudedSvgObject( paths, options );

    var finalObj;

    // If we wanted a base plate, let's create that now
    if(options.wantBasePlate) {
        // Shift the SVG portion away from the bed to account for the base
        var translateTransform = new THREE.Matrix4().makeTranslation( 0, 0, options.baseDepth );
        svgMesh.geometry.applyMatrix( translateTransform );

        // Create Base plate mesh
        var basePlateMesh = getBasePlateObject( options );

        // For constructive solid geometry (CSG) actions
        baseCSG = new ThreeBSP( basePlateMesh );
        svgCSG  = new ThreeBSP( svgMesh );

        // If we haven't inverted the type, the SVG is "inside-out"
        if(!options.wantInvertedType) {
            svgCSG = new ThreeBSP( svgCSG.tree.clone().invert() );
        }

        // Positive typeDepth means raised
        // Negative typeDepth means sunken 
        finalObj = (options.typeDepth > 0) ?
            baseCSG.union( svgCSG ).toMesh( options.material ) :
            baseCSG.intersect( svgCSG ).toMesh( options.material );
    }
    // Didn't want a base plate
    else {
        finalObj = svgMesh;
    }

    // Add the merged geometry to the scene
    group.add( finalObj );

    // Show the wireframe?
    if(options.wantWireFrame) {
        var wireframe = new THREE.WireframeHelper( finalObj, 0xffffff );
        //var wireframe = new THREE.WireframeHelper( svgMesh, 0xffffff );
        group.add( wireframe );
    }
    // Show normals?
    if(options.wantNormals) {
        var normals = new THREE.FaceNormalsHelper( finalObj, 2, 0x000000, 1 );
        group.add( normals );
    }
    // Show hard edges?
    if(options.wantEdges) {
        var edges = new THREE.EdgesHelper( finalObj, 0xffffff );
        group.add( edges );
    }
};

function getBasePlateObject( options ) {
    var basePlateMesh;
    // If we asked for a rectangle
    if(options.basePlateShape==="Rectangular") {
        var basePlate = new THREE.BoxGeometry(
            options.typeSize+options.baseBuffer,
            options.typeSize+options.baseBuffer,
            options.baseDepth );
        basePlateMesh = new THREE.Mesh(basePlate, options.material);
    }
    // Otherwise a circle
    else {
        var radius = Math.sqrt(
            Math.pow((options.typeSize/2),  2) +
            Math.pow((options.typeSize/2), 2)) + options.baseBuffer;
        var basePlate = new THREE.CylinderGeometry(
            radius,
            radius,
            options.baseDepth,
            64 );	// Number of faces around the cylinder
        basePlateMesh = new THREE.Mesh(basePlate, options.material);
        var rotateTransform = new THREE.Matrix4().makeRotationX( Math.PI/2 );
        basePlateMesh.geometry.applyMatrix( rotateTransform );
    }
    // By default, base is straddling Z-axis, put it flat on the print surface.
    var translateTransform = new THREE.Matrix4().makeTranslation( 0, 0, options.baseDepth/2 );
    basePlateMesh.geometry.applyMatrix( translateTransform );
    return basePlateMesh;
}

function getExtrudedSvgObject( paths, options ) {
    options.bevelEnabled = (options.typeDepth<0 || !options.wantBasePlate) ?
        false : options.bevelEnabled;
    var shapes = [];
    for (var i = 0; i < paths.length; ++i) {
        // Turn each SVG path into a three.js shape
        var path = d3.transformSVGPath( paths[i] );
        // We may have had the winding order backward.
        var newShapes = path.toShapes(options.svgWindingIsCW);
        // Add these three.js shapes to an array.
        shapes = shapes.concat(newShapes);
    }
    // Negative typeDepths are ok, but can't be deeper than the base
    if(options.wantBasePlate &&
        options.typeDepth < 0 &&
        Math.abs(options.typeDepth) > options.baseDepth) {
        options.typeDepth = -1 * options.baseDepth;
    }

    // Extrude all the shapes
    var extruded = new THREE.ExtrudeGeometry( shapes, {
        amount: (options.bevelEnabled) ? 0 : options.typeDepth,
        bevelEnabled: options.bevelEnabled,
        bevelThickness: options.typeDepth,
        bevelSize: options.typeDepth/4,
        bevelSegments: 1,	// Single, 45 degree bevel, not rounded
    });

    if(options.bevelEnabled) {
        // Bevels are actually created by extruding the object further than requested.
        // We need to slice the object in the plane of the build plate
        //var plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        //extruded = sliceGeometry(extruded, plane);
    }

    // Use negative scaling to invert the image
    if(!options.wantInvertedType) {
        var invertTransform = new THREE.Matrix4().makeScale( -1, 1, 1 );
        extruded.applyMatrix( invertTransform );
    }
      
    // Into a mesh of triangles
    var mesh = new THREE.Mesh(extruded, options.material);
    // Get bounding box of extruded content
    var boundBox = new THREE.Box3().setFromObject(mesh);
    var svgWidth  = (boundBox.max.x - boundBox.min.x);
    var svgHeight = (boundBox.max.y - boundBox.min.y);
    var maxBbExtent = (svgWidth>svgHeight) ? svgWidth : svgHeight;
    // Scale to requested size (lock aspect ratio)
    var scaleTransform = new THREE.Matrix4().makeScale(
        (options.typeSize  / maxBbExtent),	// locking aspect ratio by scaling
        (options.typeSize  / maxBbExtent),	// the largest dimension to that requested
        1 );				// Keep the depth as-is
    mesh.geometry.applyMatrix( scaleTransform );
    // Center on X/Y origin
    boundBox = new THREE.Box3().setFromObject(mesh);
    var translateTransform = new THREE.Matrix4().makeTranslation(
        // Half its width left
        -(Math.abs((boundBox.max.x-boundBox.min.x)/2)+boundBox.min.x),
        // Half its height downward
        -(Math.abs((boundBox.max.y-boundBox.min.y)/2)+boundBox.min.y),
        // Don't mess with the depth 
        0 );					
    mesh.geometry.applyMatrix( translateTransform );
    // Rotate 180 deg CCW
    var rotateTransform = new THREE.Matrix4().makeRotationZ( Math.PI );
    mesh.geometry.applyMatrix( rotateTransform );
    return mesh;
};

var init3d = function(){
    /// Global : renderer
    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setClearColor( 0xb0b0b0 );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );

    /// Global : scene
    scene = new THREE.Scene();

    /// Global : camera
    camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 1, 1000 );
    camera.position.set( 0, 0, 200 );

    /// Global : group
    group = new THREE.Group();
    scene.add( group );

    /// direct light
    var light = new THREE.DirectionalLight( 0x404040 );
    light.position.set( 0.75, 0.75, 1.0 ).normalize();
    scene.add( light );

    /// ambient light
    var ambientLight = new THREE.AmbientLight(0x404040);
    scene.add( ambientLight );

    /// backgroup grids
    var helper = new THREE.GridHelper( 80, 10 );
    helper.rotation.x = Math.PI / 2;
    group.add( helper );
};

