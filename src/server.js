const express = require('express');
const path = require('path');
const tilelive = require('@mapbox/tilelive');
const MBTiles = require('@mapbox/mbtiles');
MBTiles.registerProtocols(tilelive);

if (process.argv.length < 3) {
  process.stdout.write('An MBTiles directory is required.\n\n');
  process.stdout.write('Usage: npm start /path/to/mbtiles\n');
}

class SubwayTile {
  constructor(rootPath) {
    this.root = path.resolve(rootPath);
    this.cache = {};
  }

  _load(uri) {
    return new Promise((resolve, reject) => {
      tilelive.load(uri, (err, src) => (err) ? reject(err) : resolve(src));
    });
  }

  _getInfo(source) {
    return new Promise((resolve, reject) => {
      source.getInfo((err, data) => (err) ? reject(err) : resolve(data));
    });
  }

  _getTile(source, z, x, y) {
    return new Promise((resolve, reject) => {
      source.getTile(z, x, y,
        (err, tile, headers) => (err) ?
          reject(err) : resolve({tile, headers}));
    });
  }

  async getSource(relPath) {
    let absPath = path.resolve(this.root, relPath + '.mbtiles');
    if (!absPath.startsWith(this.root)) return null;

    if (this.cache.hasOwnProperty(relPath)) return this.cache[relPath];

    let sourceURI = 'mbtiles://' + absPath;

    let source;
    try {
      source = await this._load(sourceURI);
    } catch (e) {
      return null;
    }

    this.cache[relPath] = source;
    return this.cache[relPath];
  }

  async getTileJSON(relPath, tileURIs) {
    let source = await this.getSource(relPath);
    if (!source) return {err: 'Invalid source'};

    let info;
    try {
      info = await this._getInfo(source);
    } catch(e) {
      if (this.cache.hasOwnProperty(relPath)) delete this.cache[relPath];
      return {err: 'Error retrieving metadata'};
    }

    let tilejson = {
      tilejson: '2.2.0',
      name: info.name,
      scheme: 'xyz',
      tiles: tileURIs.map(
        (uri) => uri + '/' + relPath + '/{z}/{x}/{y}.' + info.format)
    };

    if (info.bounds) tilejson.bounds = info.bounds;
    if (info.center) tilejson.center = info.center;
    if (info.minzoom) tilejson.minzoom = info.minzoom;
    if (info.maxzoom) tilejson.maxzoom = info.maxzoom;
    if (info.attribution) tilejson.attribution = info.attribution;
    if (info.description) tilejson.description = info.description;
    if (info.version) tilejson.version = info.version;
    if (info.vector_layers) tilejson.vector_layers = info.vector_layers;

    return {tilejson};
  }

  async getTile(relPath, x, y, z) {
    let source = await this.getSource(relPath);
    if (!source) return {err: 'Invalid source'};

    let tileinfo;
    try {
      tileinfo = await this._getTile(source, z, x, y);
    } catch(e) {
      if (/Tile does not exist/.test(e)) return {err: 'Tile does not exist'};
      return {err: 'Error retrieving tile'};
    }

    return tileinfo;
  }
}

if (require.main === module) {
  const app = express();
  const sTile = new SubwayTile(path.resolve(process.argv[2]));

  app.get(/^\/(.+)\.json$/, async (req, res) => {
    let tileURIs = process.argv.slice(3);
    if (tileURIs.length === 0) {
      let proto = req.get('X-Forwarded-Proto') || req.protocol;
      let host = req.get('X-Forwarded-Host') || req.get('host');
      tileURIs.push([proto + '://' + host]);
    }

    let {err, tilejson} = await sTile.getTileJSON(req.params['0'], tileURIs);

    if (err === 'Invalid source') {
      return res.status(404).send(err);
    } else if (err) {
      return res.status(500).send(err);
    }

    res.send(tilejson);
  });

  app.get(/^\/(.+)\/(\d+)\/(\d+)\/(\d+)\.[a-z0-9]{3,4}$/, async (req, res) => {
    let {err, tile, headers} = await sTile.getTile(
      req.params['0'],
      parseInt(req.params['2']),
      parseInt(req.params['3']),
      parseInt(req.params['1']));

    if (err === 'Invalid source') {
      return res.status(404).send(err);
    } else if (err === 'Tile does not exist') {
      return res.status(204).send(err);
    } else if (err) {
      return res.status(500).send(err);
    }

    res.set(headers).send(tile);
  });

  app.listen(8080);
}
