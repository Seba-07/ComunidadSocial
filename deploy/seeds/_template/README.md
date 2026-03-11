# Datos seed para nueva municipalidad

Para agregar una nueva municipalidad, crear una carpeta con el nombre de la comuna
(minusculas, sin acentos) y proveer los siguientes archivos:

## Archivos requeridos

### `unidadesVecinales.json`
Array de objetos con la estructura:
```json
[
  {
    "numero": "001",
    "idOficial": "131286255",
    "nombre": "Unidad Vecinal 1",
    "macrozona": 1,
    "poblaciones": ["Poblacion X", "Villa Y"],
    "calles": ["Av. Principal", "Calle Secundaria"],
    "limites": {
      "norte": "Limite norte",
      "sur": "Limite sur",
      "oriente": "Limite oriente",
      "poniente": "Limite poniente"
    },
    "palabrasClave": ["keyword1", "keyword2"]
  }
]
```

Fuentes de datos:
- Shapefile del Ministerio de Desarrollo Social
- Municipalidad (Direccion de Desarrollo Comunitario - DIDECO)
- IDE Chile (infraestructuradedatos.cl)

### `admin.json` (opcional)
Datos del usuario administrador inicial:
```json
{
  "rut": "11.111.111-1",
  "firstName": "Administrador",
  "lastName": "Sistema",
  "email": "admin@comuna.cl",
  "password": "cambiar-en-primer-login",
  "phone": "+56 2 XXXX XXXX",
  "address": "Direccion municipalidad"
}
```

## Ejecutar seed
```bash
cd server
TENANT_COMMUNE_NAME=NombreComuna npm run seed
```
