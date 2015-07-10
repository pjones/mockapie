# REST+JSON and Static File Server

Mockapie is a simple Node.js module that serves static content from a
directory and pretends to be a database-connected REST server.

## REST+JSON

If an HTTP request is made to `/api/*` the REST+JSON server will be
activated.  The request will be handled by fetching/manipulating data
in YAML files located in the `data` directory.

Example URLs and how they map to YAML files:

  * `GET /api/artists`: Return all records from `data/artists.yml`

  * `POST /api/artists`: Add a new record to `data/artists.yml`

  * `GET /api/artists/1`: Fetch a record from `data/artists.yml` where
    the `id` attribute is `1`

  * `GET /api/artists/1/albums`: Fetch a record from `data/albums.yml`
    where the `artist_id` attribute is `1`

  * And so forth for all of the REST-related HTTP methods and
    arbitrary nesting of resources

## Static File Server

When a request does not start with `/api/*` then the static file
server will be used to serve files out of `www`.

## Default Configuration

The following values are currently hard coded:

  * Port: 3000
  * YAML directory: `data`
  * Static file directory: `www`
  * REST+JSON URL prefix: `/api/`

## Example Application

  * [AngularJS Course](https://github.com/devalot/angularjs) source code.
