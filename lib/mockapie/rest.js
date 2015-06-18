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
// Fake JSON RESTful service using YAML files.
module.exports = (function() {
  "use strict";

  /****************************************************************************/
  var db   = require('./db'),
      url  = require('url'),
      path = require('path');

  /****************************************************************************/
  var fileName = function(dir, collection) {
    return path.join(dir, path.normalize(collection) + ".yml");
  };

  /****************************************************************************/
  var badRoute = function(response, error) {
    var body = error === undefined ? "No such entity" : error.toString();

    response.writeHead(404, {
      "Content-Type":   "text/plain",
      "Content-Length": body.length,
    });

    response.end(body);
  };

  /****************************************************************************/
  var resourcePredicate = function(name, id) {
    if (!!name && !!id) {
      return function(e) {
        return e.hasOwnProperty(name) && e[name] === id;
      };
    } else {
      return function() {
        return true;
      };
    }
  };

  /****************************************************************************/
  var resourcePredicateID = function(id) {
    return resourcePredicate("id", id);
  };

  /****************************************************************************/
  var resourcePredicateTwo = function(nameA, idA, nameB, idB) {
    var p1 = resourcePredicate(nameA, idA);
    var p2 = resourcePredicate(nameB, idB);

    return function(e) {
      return p1(e) && p2(e);
    };
  };

  /****************************************************************************/
  var withRoute = function(request, response, prefix, dir, callback) {
    var path  = url.parse(request.url).pathname.substr(prefix.length);
    var parts = path.split("/");
    var id, pid, file, predicate, single, parent, parent_id;

    if (path.length > 0 && parts.length > 0) {
      file = parts[0];
      id = parts[1] === undefined ? null : parseInt(parts[1]);
      single = id !== null;
      predicate = resourcePredicateID(id);

      if (parts.length >= 3) {
        // Hack to make resource singular.
        parent = file.substr(0, file.length - 1);
        parent_id = parent + "_id";

        // New resource.
        file = parts[2];
        single = false;
        predicate = resourcePredicate(parent_id, id);

        if (parts.length >= 4) {
          // New ID;
          pid = id;
          id = parseInt(parts[3]);
          single = true;
          predicate = resourcePredicateTwo(parent_id, pid, "id", id);
        }
      }

      callback({
        file:      fileName(dir, file), // Resource file name.
        name:      file,                // Resource name.
        id:        id,                  // Resource ID.
        single:    single,              // One or more resources.
        predicate: predicate,           // Predicate function.
      });
    } else {
      badRoute(response, "invalid REST path");
    }
  };

  /****************************************************************************/
  var sendJSON = function(response, object, status) {
    var body = object === undefined ? "" : JSON.stringify(object);

    response.writeHead(status || 200, {
      "Content-Type":   "application/json",
      "Content-Length": body.length,
    });

    response.end(body);
  };

  /****************************************************************************/
  var readJSON = function(request, callback) {
    var json = "";

    request.on("data", function(d) {json += d.toString();});
    request.on("end",  function()  {callback(JSON.parse(json));});
  };

  /****************************************************************************/
  var dropBody = function(request, callback) {
    request.on("end", callback).resume();
  };

  /****************************************************************************/
  var get = function(response, resource) {
    var matches;

    db.readFile(resource.file, function(error, objects) {
      if (error) return badRoute(response, error);
      matches = objects.filter(resource.predicate);

      if (resource.single) {
        if (matches.length === 0) return badRoute(response, "invalid ID");
        sendJSON(response, matches[0]);
      } else {
        sendJSON(response, matches);
      }
    });
  };

  /****************************************************************************/
  var create = function(request, response, resource) {
    readJSON(request, function(object) {
      if (Array.isArray(object)) return badRoute(response, "POST with array!");

      db.modifyFile(resource.file, function(error, objects) {
        if (error) return badRoute(response, error);

        var maxID = objects.reduce(function(acc, elem) {
          if (elem.hasOwnProperty("id") && elem.id > acc) {
            return elem.id;
          } else {
            return acc;
          }
        }, 0);

        object.id = maxID + 1;
        objects.push(object);

        // TODO: This should include the parent resource location.
        response.setHeader("Location", "/" + resource.name + "/" + object.id);
        sendJSON(response, object, 201);
        return objects;
      });
    });
  };

  /****************************************************************************/
  var update = function(request, response, resource) {
    readJSON(request, function(object) {
      if (Array.isArray(object)) return badRoute(response, "PUT/PATCH with array!");

      db.modifyFile(resource.file, function(error, objects) {
        if (error) return badRoute(response, error);
        var found = false;

        var updated = objects.map(function(e) {
          if (e.hasOwnProperty("id") && e.id === resource.id) {
            object.id = resource.id;
            found = true;
            return object;
          } else {
            return e;
          }
        });

        sendJSON(response, undefined, found ? 204 : 404);
        return updated;
      });
    });
  };

  /****************************************************************************/
  var destroy = function(response, resource) {
    db.modifyFile(resource.file, function(error, objects) {
      if (error) return badRoute(response, error);

      // Negate the filter.
      var updated = objects.filter(function(e) {
        return !resource.predicate(e);
      });

      var found = updated.length !== objects.length;
      sendJSON(response, undefined, found ? 204 : 404);

      return updated;
    });
  };

  /****************************************************************************/
  var route = function(request, response, prefix, dir) {
    withRoute(request, response, prefix, dir, function(resource) {
      switch (request.method) {
      case "GET":
        dropBody(request, function() {get(response, resource);});
        break;

      case "POST":
        if (resource.id !== null) return badRoute(response, "POST must not have an ID");
        create(request, response, resource);
        break;

      case "PATCH":
      case "PUT":
        if (resource.id === null) return badRoute(response, "PUT must have an ID");
        update(request, response, resource);
        break;

      case "DELETE":
        if (resource.id === null) return badRoute(response, "DELETE must have an ID");
        dropBody(request, function() {destroy(response, resource);});
        break;

      default:
        return badRoute(response, "invalid REST method");
      }
    });
  };

  /****************************************************************************/
  return {
    route: route,
  };
})();
