/******************************************************************************/
/*
 * This file is part of the package mockapie. It is subject to the
 * license terms in the LICENSE file found in the top-level directory
 * of this distribution and at git://pmade.com/mockapie/LICENSE. No
 * part of the mockapie package, including this file, may be copied,
 * modified, propagated, or distributed except according to the terms
 * contained in the LICENSE file.
*/

/******************************************************************************/
module.exports = {
  createServer: function(port, www, data) {
    "use strict";

    // Library imports.
    var nodestatic = require('node-static'),
        http       = require('http'),
        fs         = require('fs'),
        rest       = require('./mockapie/rest');

    www  = fs.realpathSync(www);
    data = fs.realpathSync(data);

    var apiPrefix = "/api/";
    var apiRe     = /^\/api\//;

    var fileServer = new nodestatic.Server(www, {
      cache: 0 // Don't cache files.
    });

    http.createServer(function(request, response) {
      if (apiRe.test(request.url)) {
        console.log("REST: " + request.method + " " + request.url);
        rest.route(request, response, apiPrefix, data);
      } else {
        request.on("end", function() {
          console.log(" WWW: " + request.method + " " + request.url);
          fileServer.serve(request, response);
        }).resume();
      }
    }).listen(port);

    console.log("Server running at http://localhost:" + port);
    console.log("With static files from " + www);
    console.log("And data files from " + data);
    console.log("Press Ctrl-c to terminate the server");
  }
};
