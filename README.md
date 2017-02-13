# SVG to STL Converter
Created to enable the 3D printing of plates for a [printing press] from a 2D vector graphic, this tool runs entirely in the local browser. As the name implies, it takes a [scalable vector graphics] \(SVG\) file as input, and produces an ASCII [stereo-lithography] \(STL\) file as output.

### Demo
You can try the tool [hosted directly from github].

There are example SVG files in [example-svg/Entypo].

### Screenshot
 ![Screenshot](https://github.com/rcalme/svg-to-stl/blob/master/screenshot.png)

### Options
  - Specifying type height
    - Including indented/recessed type
  - Rendering with and without a base plate
    - Round and Rectangular base plates supported
    - Specifying base plate height
  - Optionally inverting type for printing press use
  - Optionally flaring the base of type for added strength
  - Reversing the winding order (CW/CCW) of SVG paths for incorrectly-built SVG files

### Known problems
  - A hole in an SVG path should be defined by points in counter-clockwise order, where the shape outline is defined by points in a clockwise order, or vice versa. Some SVG creation tools don't do this correctly, and shapes render in 3D space as "inside out".
    - You can try the "Reverse Winding Order" option to fix this, but it's possible to have both combinations of winding in the same file, ensuring that some part is always inside out.
  - A hole that is not a hole, but an additional shape filled with background color will not render as a hole.
  - SVG text elements are not supported. To render text, you need to convert the text to "outlines" or "paths" before saving the SVG file.
  - SVG paths that include scientific notation cause d3-threeD to loop infinitely. Saving as "Optimized SVG" in Inkscape ensures that this format is not used.

### Requirements
This tool requires javascript support, and a browser that can handle a [WebGL] canvas, and the [File API].

### Version
0.5

### Tools Used
svg-to-stl makes use of a number of other open source projects:
* [three.js] - For WebGL rendering of a 3D scene
* [d3-threeD] - For converting SVG paths into three.js geometries
* [flatten.js] - For applying all heirarchical transforms in an SVG to its paths
* [ThreeCSG] - For [Constructive Solid Geometry] support
* [STLExporter] - For converting a three.js geometry into an ASCII STL file
* [Spectrum] - For a javascript color-picker
* [Entypo] - Example SVG files to play with
* [jQuery]


   [printing press]: <https://en.wikipedia.org/wiki/Printing_press>
   [scalable vector graphics]: <https://en.wikipedia.org/wiki/Scalable_Vector_Graphics>
   [stereo-lithography]: <https://en.wikipedia.org/wiki/STL_(file_format)>
   [hosted directly from github]: <https://rawgit.com/ryancalme/svg-to-stl/master/SVGtoSTL.html>
   [example-svg/Entypo]: </example-svg/Entypo>
   [WebGL]: <https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API>
   [File API]: <http://www.w3.org/TR/FileAPI/>
   [Constructive Solid Geometry]: <https://en.wikipedia.org/wiki/Constructive_solid_geometry>
   [three.js]: <https://github.com/mrdoob/three.js>
   [d3-threeD]: <https://github.com/asutherland/d3-threeD>
   [flatten.js]: <https://gist.github.com/timo22345/9413158>
   [ThreeCSG]: <https://github.com/chandlerprall/ThreeCSG>
   [STLExporter]: <https://gist.github.com/kjlubick/fb6ba9c51df63ba0951f>
   [Spectrum]: <https://github.com/bgrins/spectrum>
   [Entypo]: <http://www.entypo.com>
   [jQuery]: <https://jquery.com/>
