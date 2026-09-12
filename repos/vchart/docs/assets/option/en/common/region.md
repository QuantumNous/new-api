{{ target: common-region }}

<!-- IRegionSpec -->

## region(Array)

Region configuration

<!-- Chart layout configuration -->
<!-- IRegionSpec -->

### id(string|number)

The id of the region, which can be used to reference this region in other modules.

{{ var: defaultCoordinate = ${regionType} === 'geo' ? 'geo' : ${axisType} }}

### coordinate(string) = '${defaultCoordinate}'

Coordinate system type

Available options:

- `'cartesian'`: Cartesian coordinate system
- `'polar'`: Polar coordinate system
- `'geo'`: Geographical coordinate system

{{ if: ${regionType} === 'geo' }}

### roam(boolean|Object) = false

Allow dragging and scaling.
Since version `1.12.8`, it supports configuring `roam.blank: true` to enable dragging in the blank area fo region.

### longitudeField(string)

The longitude field name in the data, typically used for specifying data fields in `common` chart non-map series combinations.

### latitudeField(string)

The latitude field name in the data, typically used for specifying data fields in `common` chart non-map series combinations.

### projection(string)

Geographical mapping configuration

#### type(string) = 'mercator'

Geographical mapping type. Built-in projection types are as follows:

- `albers`: Albers projection, centered on the USA by default, with center at Hutchinson.
- `albersUsa`: Composite projection, used to display the lower 48 in the United States, does not support rotation or centering operations.
- `azimuthalEqualArea`: Azimuthal equal area projection, preserves the true relative size of features.
- `azimuthalEquidistant`: Azimuthal equidistant projection, preserves precise center point distances and directions.
- `conicConformal`: Conical Conformal projection, belongs to conical projection, suitable for mid-latitude regions.
- `conicEqualArea`: Albers equal area conic projection, minimal deformation in areas between standard parallels.
- `conicEquidistant`: Equidistant conic projection, equal spacing along meridians for all circular parallels.
- `equalEarth`: Equal area pseudocylindrical projection, parallel straight latitudinal lines, suitable for drawing small-scale maps.
- `equirectangular`: Equirectangular projection, simple calculations yet severe distortions at the poles.
- `gnomonic`: Gnomonic projection, with Earth's center as the perspective point, unable to simultaneously project tropics and poles.
- `mercator`: Mercator projection, latitudinal spacing increases closer to the poles, and poles cannot be represented.
- `naturalEarth1`: Natural Earth projection, no area distortion in longitude.
- `orthographic`: Orthographic projection, azimuthal projection, more suitable for displaying a single hemisphere.
- `stereographic`: Stereographic projection, conformal, accurate local shape, but usually limited to one hemisphere.
- `transverseMercator`: Transverse Mercator projection, reduces deformation within the area of interest to the greatest extent possible.

#### zoom(number) = 1

Initial scaling factor.

#### center([number, number])

Initial latitude and longitude of the center point.

### zoomLimit(object)

Maximum and minimum scaling limits.

#### min(number)

Minimum scaling limit, unlimited by default.

#### max(number)

Maximum scaling limit, unlimited by default.
{{ /if}}

### style(Object)

Background style settings.

{{ use: graphic-rect(
  prefix = '###'
) }}

### stackInverse(boolean)

Supported since `1.4.0` version, Whether to reverse the order when stacking

### stackSort(boolean)

Supported since `1.10.4` version, Whether to sorting data when stacking

{{ use: common-layout-item(
  prefix = '##',
  defaultLayoutType = 'region',
  defaultLayoutLevel = 10,
  defaultLayoutZIndex = 450,
  isRegion = true,
) }}
