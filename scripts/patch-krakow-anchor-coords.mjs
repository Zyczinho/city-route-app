import {readFile,writeFile} from 'node:fs/promises';
const path='data/cities/krakow/anchors.json';
const anchors=JSON.parse(await readFile(path,'utf8'));
const coords={
  'mercy-brown':{lat:50.061512,lng:19.931628},
  'central-square-nowa-huta':{lat:50.07190,lng:20.03780}
};
for(const anchor of anchors){if(coords[anchor.id])Object.assign(anchor,coords[anchor.id]);}
await writeFile(path,JSON.stringify(anchors,null,2)+'\n');
console.log('Pinned curated coordinates for ambiguous Krakow anchors.');
