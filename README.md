# Subway Tile
Unobtrusive tile server for MBTiles.

## Usage
```
npm run -- [data_root] [tile_uris]
```
### Example
```
npm run -- /data https://a.tile.example.com https://b.tile.example.com
```

Given a tileset with the path `/data/research/landuse.mbtiles` and the above
configuration, the endpoints are:

```
# TileJSON
http://localhost:8080/research/landuse.json

# Tiles
https://a.tile.example.com/research/landuse/{z}/{x}/{y}.pbf
https://b.tile.example.com/research/landuse/{z}/{x}/{y}.pbf
```
