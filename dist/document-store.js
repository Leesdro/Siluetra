// The only append boundary for document records, including derived panel regions.
export function appendObjects(objects,records){const ids=new Set(objects.map(o=>o.id));for(const o of records){if(!o?.id||ids.has(o.id))throw Error('El objeto ya existe en el documento.');ids.add(o.id);}objects.push(...records);return records;}
