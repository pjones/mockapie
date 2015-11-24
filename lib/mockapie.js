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
        io         = require('socket.io')(),
        rest       = require('./mockapie/rest');

    www  = fs.realpathSync(www);
    data = fs.realpathSync(data);

    var apiPrefix = "/api/";
    var apiRe     = /^\/api\//;

    var fileServer = new nodestatic.Server(www, {
      cache: 0 // Don't cache files.
    });

    var app = http.createServer(function(request, response) {
      if (apiRe.test(request.url)) {
        var message = "REST: " + request.method + " " + request.url;
        io.sockets.emit('log', message);
        console.log(message);

        rest.route(request, response, apiPrefix, data);
      } else {
        request.on("end", function() {
          var message = " WWW: " + request.method + " " + request.url;
          io.sockets.emit('log', message);
          console.log(message);

          fileServer.serve(request, response);
        }).resume();
      }
    }).listen(port);

    // Link the WebSockets server to the server created above.
    io.attach(app);

    console.log("Server running at http://localhost:" + port);
    console.log("With static files from " + www);
    console.log("And data files from " + data);
    console.log("Press Ctrl-c to terminate the server");
  }
};
