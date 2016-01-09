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

    // Will hold the joined geometry
    var finalObj;

    // If we wanted a base plate, let's create that now
    if(options.wantBasePlate) {
        // Shift the SVG portion away from the bed to account for the base
        var translateTransform = new THREE.Matrix4().makeTranslation( 0, 0, options.baseDepth );
        svgMesh.geometry.applyMatrix( translateTransform );

        // Create Base plate mesh
        var basePlateMesh = getBasePlateObject( options, svgMesh );

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

// Creates a three.js Mesh object for a base plate
function getBasePlateObject( options, svgMesh ) {
    var basePlateMesh;
    
    // If we asked for a rectangle
    if(options.basePlateShape==="Rectangular") {
        // Determine the finished size of the extruded SVG with potential bevel
        var svgBoundBox = svgMesh.geometry.boundingBox;
        var svgWidth  = (svgBoundBox.max.x - svgBoundBox.min.x);
        var svgHeight = (svgBoundBox.max.y - svgBoundBox.min.y);
        var maxBbExtent = (svgWidth>svgHeight) ? svgWidth : svgHeight;
        // Now make the rectangular base plate
        var basePlate = new THREE.BoxGeometry(
            maxBbExtent+options.baseBuffer,
            maxBbExtent+options.baseBuffer,
            options.baseDepth );
        basePlateMesh = new THREE.Mesh(basePlate, options.material);
    }
    // Otherwise a circle
    else {
        // Find SVG bounding radius
        var svgBoundRadius = svgMesh.geometry.boundingSphere.radius;
        //var radius = Math.sqrt(
        //    Math.pow((maxBbExtent/2),  2) +
        //    Math.pow((maxBbExtent/2), 2)) + options.baseBuffer;
        var basePlate = new THREE.CylinderGeometry(
            svgBoundRadius + options.baseBuffer,
            svgBoundRadius + options.baseBuffer,
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

// Creates a three.js Mesh object out of SVG paths
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

    // Extrude all the shapes WITHOUT BEVEL
    var extruded = new THREE.ExtrudeGeometry( shapes, {
        amount: options.typeDepth,
        bevelEnabled: false
    });

    // Find the bounding box of this extrusion with no bevel
    // there's probably a smarter way to get a bounding box without extruding...
    extruded.computeBoundingBox();
    var svgWidth  = (extruded.boundingBox.max.x - extruded.boundingBox.min.x);
    var svgHeight = (extruded.boundingBox.max.y - extruded.boundingBox.min.y);
    var maxBbExtent = (svgWidth>svgHeight) ? svgWidth : svgHeight;

    // Extrude with bevel instead if requested.
    if(options.bevelEnabled) {
        extruded = new THREE.ExtrudeGeometry( shapes, {
            amount: (options.bevelEnabled) ? 0 : options.typeDepth,
            bevelEnabled: options.bevelEnabled,
            bevelThickness: options.typeDepth,
            // Since we're going to scale X/Y shortly, but not Z,
            // Precompute this to account for X/Y scaling
            // So that we maintain a 45 deg bevel
            // (could also have extruded more, then scaled in all 3 dimensions after)
            bevelSize: options.typeDepth * (maxBbExtent / options.typeSize),
            bevelSegments: 1,	// Single-face, angled bevel
        });
    }

    // Use negative scaling to invert the image
    // Why do we have to flip the image to keep original SVG orientation?
    if(!options.wantInvertedType) {
        var invertTransform = new THREE.Matrix4().makeScale( -1, 1, 1 );
        extruded.applyMatrix( invertTransform );
    }
      
    // Into a mesh of triangles
    var mesh = new THREE.Mesh(extruded, options.material);

    // Scale to requested size (lock aspect ratio)
    var scaleTransform = new THREE.Matrix4().makeScale(
        (options.typeSize  / maxBbExtent),  // locking aspect ratio by scaling
        (options.typeSize  / maxBbExtent),  // the largest dimension to that requested
        1 );                                // Keep the depth as-is
    mesh.geometry.applyMatrix( scaleTransform );

    // Center on X/Y origin
    mesh.geometry.computeBoundingBox();
    boundBox = mesh.geometry.boundingBox;
    var translateTransform = new THREE.Matrix4().makeTranslation(
        // Half its width left
        -(Math.abs((boundBox.max.x-boundBox.min.x)/2)+boundBox.min.x),
        // Half its height downward
        -(Math.abs((boundBox.max.y-boundBox.min.y)/2)+boundBox.min.y),
        // Don't mess with the depth 
        0 );					
    mesh.geometry.applyMatrix( translateTransform );

    // Rotate 180 deg
    // Why is this required? Different coordinate systems for SVG and three.js?
    var rotateTransform = new THREE.Matrix4().makeRotationZ( Math.PI );
    mesh.geometry.applyMatrix( rotateTransform );

    // So that these attributes of the mesh are populated for later
    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();
    return mesh;
};

