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
// Fake database using YAML files.
module.exports = (function() {
  "use strict";

  /****************************************************************************/
  var fs       = require('fs'),
      path     = require('path'),
      lockfile = require('lockfile'),
      yaml     = require('js-yaml');

  /****************************************************************************/
  // Lock file options;
  var lockopts = {
    wait:       1000, // Number of ms to wait for file to unlock.
    pollPeriod: 250,  // Number of ms to wait to check again.
    stale:      950,  // Number of ms before a lock is stale.
    retries:    5,    // Number of times to retry.
    retryWait:  250,  // Number of ms between retries.
  };

  /****************************************************************************/
  var exists = function(file, callback) {
    if (fs.exists) {
      return fs.exists(file, callback);
    } else if (path.exists) {
      return path.exists(file, callback);
    } else {
      return callback(true);
    }
  };

  /****************************************************************************/
  var withLock = function(file, callback) {
    exists(file, function(fileExists) {
      if (!fileExists) return callback("no such file: " + file);
      var name = file + ".lock";

      return lockfile.lock(name, lockopts, function(error) {
        try     { callback(error);                       }
        finally { if (!error) lockfile.unlockSync(name); }
      });
    });
  };

  /****************************************************************************/
  // Read primitive.  DOES NOT LOCK FILE.
  var read = function(file, callback) {
    var doc = yaml.safeLoad(fs.readFileSync(file, "utf8"));
    callback(null, doc);
  };

  /****************************************************************************/
  // Write primitive.  DOES NOT LOCK FILE.
  var write = function(file, objects, callback) {
    fs.writeFileSync(file, yaml.safeDump(objects));
    callback(null);
  };

  /****************************************************************************/
  // Read in a YAML file.  The callback will either be called with an
  // error or a list of objects from the file.
  var readFile = function(file, callback) {
    return withLock(file, function(error) {
      if (error) return callback(error);
      read(file, callback);
    });
  };

  /****************************************************************************/
  // Write a YAML file.  Write the given objects into a YAML file and
  // call the continuation to move forward.
  var writeFile = function(file, objects, callback) {
    return withLock(file, function(error) {
      if (error) return callback(error);
      write(file, objects, callback);
    });
  };

  /****************************************************************************/
  var modifyFile = function(file, callback) {
    return withLock(file, function(error) {
      if (error) return callback(error);
      read(file, function(readError, objects) {
        if (readError) return callback(readError);
        write(file, callback(null, objects), function(writeError) {
          if (writeError) return callback(writeError);
        });
      });
    });
  };

  /****************************************************************************/
  return {
    readFile:   readFile,
    writeFile:  writeFile,
    modifyFile: modifyFile,
  };
})();
