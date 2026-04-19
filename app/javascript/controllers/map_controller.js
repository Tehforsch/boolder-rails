import { Controller } from '@hotwired/stimulus'

export default class extends Controller {
  static targets = [
    "map",
    "gradeRadioButton", "gradeMin", "gradeMax", "customGradePicker",
    "filterCounter", "filterIcon"
  ]
  static values = {
    bounds: Object,
    problem: Object,
    locale: { type: String, default: 'en' },
    draft: { type: Boolean, default: false },
    contribute: { type: Boolean, default: false },
    contributeSource: String,
    circuit7a: { type: Boolean, default: false },
    circuit7aSource: String,
  }

  connect() {
    this.map = new maplibregl.Map({
      container: 'map',
      hash: true,
      style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/">CARTO</a>'
          }
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
      },
      bounds: [[2.4806787, 48.2868427],[2.7698927,48.473906]],
      padding: 5,
    });

    this.addControls()

    this.map.on('load', () => {
      this.addLayers()
      this.centerMap()
      this.cleanHistory()
    });

    this.popup = null
    this.map.on('moveend', () => {
      if(this.popup != null) {
        this.popup.addTo(this.map)
        this.popup = null
      }
    });

    this.setupClickEvents()

    this.allGrades = ["1a","1a+","1b","1b+","1c","1c+","2a","2a+","2b","2b+","2c","2c+","3a","3a+","3b","3b+","3c","3c+","4a","4a+","4b","4b+","4c","4c+","5a","5a+","5b","5b+","5c","5c+","6a","6a+","6b","6b+","6c","6c+","7a","7a+","7b","7b+","7c","7c+","8a","8a+","8b","8b+","8c","8c+","9a","9a+","9b","9b+","9c","9c+",]
  }

  addControls() {
    this.map.addControl(
      new maplibregl.ScaleControl({
        maxWidth: 100,
        unit: 'metric'
       })
    );

    this.map.addControl(
      new maplibregl.NavigationControl()
    );

    this.map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true
        },
        trackUserLocation: true,
        showUserHeading: true
      })
    );
  }

  addLayers() {
    let outlineColor = "#888888";

    // CLUSTERS
    this.map.addSource('clusters-data', {
      type: 'geojson',
      data: '/map_data/clusters'
    });

    this.map.addLayer({
      id: 'clusters-hulls',
      type: 'fill',
      source: 'clusters-data',
      filter: ['==', ['geometry-type'], 'Polygon'],
      maxzoom: 12,
      paint: {
        'fill-color': outlineColor,
        'fill-opacity': 0.08
      }
    });

    this.map.addLayer({
      id: 'clusters',
      type: 'symbol',
      source: 'clusters-data',
      filter: ['==', ['geometry-type'], 'Point'],
      maxzoom: 12,
      layout: {
        'text-field': ['get', 'name'],
        'text-size': 14,
        'text-anchor': 'center'
      },
      paint: {
        'text-color': '#2d6a1e',
        'text-halo-color': '#fff',
        'text-halo-width': 1.5
      }
    });

    // AREAS
    this.map.addSource('areas-data', {
      type: 'geojson',
      data: '/map_data/areas'
    });

    this.map.addLayer({
      id: 'areas-hulls',
      type: 'fill',
      source: 'areas-data',
      filter: ['==', ['geometry-type'], 'Polygon'],
      minzoom: 12,
      maxzoom: 15,
      paint: {
        'fill-color': outlineColor,
        'fill-opacity': [
          'interpolate', ['linear'], ['zoom'],
          12, 0.08,
          15, 0.02
        ]
      }
    });

    this.map.addLayer({
      id: 'areas-hulls-outline',
      type: 'line',
      source: 'areas-data',
      filter: ['==', ['geometry-type'], 'Polygon'],
      minzoom: 12,
      maxzoom: 15,
      paint: {
        'line-color': outlineColor,
        'line-width': 1.5,
        'line-opacity': 0.4
      }
    });

    this.map.addLayer({
      id: 'areas',
      type: 'symbol',
      source: 'areas-data',
      filter: ['==', ['geometry-type'], 'Point'],
      minzoom: 12,
      maxzoom: 15,
      layout: {
        'text-field': ['get', 'name'],
        'text-size': [
          'interpolate', ['linear'], ['zoom'],
          12, 10,
          14, 14
        ],
        'text-anchor': 'center',
        'text-allow-overlap': false
      },
      paint: {
        'text-color': '#2d6a1e',
        'text-halo-color': '#fff',
        'text-halo-width': 1.5
      }
    });

    // POIS
    this.map.addSource('pois-data', {
      type: 'geojson',
      data: '/map_data/pois'
    });

    this.map.addLayer({
      id: 'pois',
      type: 'circle',
      source: 'pois-data',
      minzoom: 12,
      paint: {
        'circle-radius': 5,
        'circle-color': '#4A90D9',
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#fff'
      }
    });

    this.map.addLayer({
      id: 'pois-labels',
      type: 'symbol',
      source: 'pois-data',
      minzoom: 14,
      layout: {
        'text-field': ['get', 'shortName'],
        'text-size': 10,
        'text-offset': [0, 1.5],
        'text-anchor': 'top'
      },
      paint: {
        'text-color': '#555',
        'text-halo-color': '#fff',
        'text-halo-width': 1
      }
    });

    // PROBLEMS
    this.map.addSource('problems', {
      type: 'geojson',
      data: '/map_data/problems',
      promoteId: 'id'
    });

    this.map.addLayer({
      'id': 'boulders',
      'type': 'fill',
      'source': 'problems',
      'minzoom': 15,
      'paint': {
        'fill-color': '#D2691E',
        'fill-opacity': [
          'interpolate', ['linear'], ['zoom'],
          15, 0,
          17, 0.15
        ]
      },
      filter: [
        'match',
          ['geometry-type'],
          ['Polygon'],
          true,
          false
      ],
    });

    this.map.addLayer({
      'id': 'boulders-outline',
      'type': 'line',
      'source': 'problems',
      'minzoom': 15,
      'paint': {
        'line-color': '#D2691E',
        'line-width': 1,
        'line-opacity': [
          'interpolate', ['linear'], ['zoom'],
          15, 0,
          17, 0.4
        ]
      },
      filter: [
        'match',
          ['geometry-type'],
          ['Polygon'],
          true,
          false
      ],
    });

    this.map.addLayer({
      'id': 'problems',
      'type': 'circle',
      'source': 'problems',
      'minzoom': 15,
      'layout': {
        'visibility': 'visible',
        'circle-sort-key':
          [
            "case",
            ["has", "circuitId"],
            2,
            1
          ]
      },
      'paint': {
        'circle-radius':
          [
            "interpolate",
            ["linear"],
            ["zoom"],
            15,
            2,
            18,
            4,
            22,
            [
              "case",
              ["has", "circuitNumber"],
              16,
              10
            ]
          ]
        ,
        'circle-color':
          [
            "case",
            ["==", ["get", "circuitColor"], "yellow"], "#FFCC02",
            ["==", ["get", "circuitColor"], "purple"], "#D783FF",
            ["==", ["get", "circuitColor"], "orange"], "#FF9500",
            ["==", ["get", "circuitColor"], "green"], "#77C344",
            ["==", ["get", "circuitColor"], "blue"], "#017AFF",
            ["==", ["get", "circuitColor"], "skyblue"], "#5AC7FA",
            ["==", ["get", "circuitColor"], "salmon"], "#FDAF8A",
            ["==", ["get", "circuitColor"], "red"], "#FF3B2F",
            ["==", ["get", "circuitColor"], "black"], "#000",
            ["==", ["get", "circuitColor"], "white"], "#FFFFFF",
            "#878A8D"
          ]
        ,
        'circle-opacity':
        [
          "interpolate",
          ["linear"],
          ["zoom"],
          14.5,
          0,
          15,
          1
        ]
      },
      filter: [
        "match",
          ["geometry-type"],
          ["Point"],
          true,
          false
      ],
    });

    this.map.addLayer({
      'id': 'problems-texts',
      'type': 'symbol',
      'source': 'problems',
      'minzoom': 19,
      'layout': {
        'visibility': 'visible',
        'text-allow-overlap': true,
        'text-field': [
          "to-string",
          ["get", "circuitNumber"]
        ],
        'text-size': [
          "interpolate",
          ["linear"],
          ["zoom"],
          19,
          10,
          22,
          20
        ],
      },
      'paint': {
        'text-color':
          [
            "case",
            ["==", ["get", "circuitColor"], "white"],
            "#333",
            "#fff",
          ]
        ,
      },
      filter: [
        "match",
          ["geometry-type"],
          ["Point"],
          true,
          false
      ],
    });

    // CONTRIBUTE LAYERS

    if(this.contributeValue) {

      this.map.addSource('contribute', {
        type: 'geojson',
        data: this.contributeSourceValue,
      });

      this.map.addLayer({
      'id': 'contribute-problems',
      'type': 'circle',
      'source': 'contribute',
      'layout': {
        'visibility': 'visible',
        'circle-sort-key':
          [
            "case",
            ["has", "circuitId"],
            2,
            1
          ]
      },
      'paint': {
        'circle-radius':
          [
            "interpolate",
            ["linear"],
            ["zoom"],
            12,
            6,
            17,
            20,
            18,
            25,
            19,
            50,
            20,
            50,
            21,
            50,
            22,
            20,
          ]
        ,
        'circle-color': "#FFCC02",
        'circle-opacity': 0.25,
        'circle-stroke-width': 2,
        'circle-stroke-color': 'white'
      },
      filter: [
        "match",
          ["geometry-type"],
          ["Point"],
          true,
          false
      ],
      });

      this.map.addLayer({
      'id': 'contribute-problems-texts',
      'type': 'symbol',
      'source': 'contribute',
      'minzoom': 16,
      'layout': {
        'visibility': 'visible',
        'text-allow-overlap': true,
        'text-field': [
          "to-string",
          ["get", "name"]
        ],
        'text-size': [
          "interpolate",
          ["linear"],
          ["zoom"],
          19,
          10,
          22,
          20
        ],
      },
      'paint': {
        'text-color': "#333",
        'text-halo-color': "hsl(0, 0%, 100%)",
        'text-halo-width': 1,
      },
      filter: [
        "match",
          ["geometry-type"],
          ["Point"],
          true,
          false
      ],
      });
    }

    // CIRCUIT 7A LAYERS

    if(this.circuit7aValue) {

      this.map.addSource('circuit7a', {
        type: 'geojson',
        data: this.circuit7aSourceValue,
      });

      this.map.addLayer({
      'id': 'circuit7a-problems',
      'type': 'circle',
      'source': 'circuit7a',
      'layout': {
        'visibility': 'visible',
        'circle-sort-key':
          [
            "case",
            ["has", "circuitId"],
            2,
            1
          ]
      },
      'paint': {
        'circle-radius':
          [
            "interpolate",
            ["linear"],
            ["zoom"],
            12,
            6,
            22,
            15
          ]
        ,
        'circle-color': "#FFDC36",
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff'
      },
      filter: [
        "match",
          ["geometry-type"],
          ["Point"],
          true,
          false
      ],
      });

      this.map.addLayer({
      'id': 'circuit7a-problems-texts',
      'type': 'symbol',
      'source': 'circuit7a',
      'minzoom': 13,
      'layout': {
        'visibility': 'visible',
        'text-field': [
          "to-string",
          ["get", "index"]
        ],
        'text-size': [
          "interpolate",
          ["linear"],
          ["zoom"],
          12,
          10,
          22,
          20
        ],
      },
      'paint': {
        'text-color': "#fff",
      },
      filter: [
        "match",
          ["geometry-type"],
          ["Point"],
          true,
          false
      ],
      });

      // circuit7a bike route removed (was hosted on Mapbox)
    }
  }

  centerMap() {
    if(this.hasBoundsValue) {
      let bounds = this.boundsValue

      this.flyToBounds([[bounds.southWestLon, bounds.southWestLat], [bounds.northEastLon, bounds.northEastLat]])
    }

    if(this.hasProblemValue) {
      let problem = this.problemValue

      this.map.flyTo({
        center: [problem.lon, problem.lat],
        zoom: 20,
        speed: 2
      });

      if(!this.contributeValue && !this.circuit7aValue) {

        const coordinates = [problem.lon, problem.lat];
        var name = problem.name
        if(this.localeValue == 'en' && problem.nameEn) {
          name = problem.nameEn
        }
        const html = `<a href="/${this.localeValue}/redirects/new?problem_id=${problem.id}" target="_blank">${name || ""}</a><span class="text-gray-400 ml-1">${problem.grade}</span>`;

        this.popup = new maplibregl.Popup({closeButton:false, focusAfterOpen: false, offset: [0, -8]})
          .setLngLat(coordinates)
          .setHTML(html)
      }
    }
  }

  cleanHistory() {
    this.map.on('movestart', () => {
      var url = ""
      if(this.contributeValue) {
        url = `/${this.localeValue}/mapping/map`
      }
      else if(this.circuit7aValue) {
        url = `/${this.localeValue}/circuit7a/map`
      }
      else {
        url = `/${this.localeValue}/map`
      }

      history.replaceState({} , '', url)
    });
  }

  setupClickEvents() {

    if(!this.circuit7aValue) {
      this.map.on('mouseenter', 'problems', () => {
        this.map.getCanvas().style.cursor = 'pointer';
      });
      this.map.on('mouseleave', 'problems', () => {
        this.map.getCanvas().style.cursor = '';
      });

      this.map.on('click', 'problems', (e) => {

        let problem = e.features[0].properties

        const coordinates = e.features[0].geometry.coordinates.slice();
        var name = problem.name
        if(this.localeValue == 'en' && problem.nameEn) {
          name = problem.nameEn
        }
        const html = `<a href="/${this.localeValue}/redirects/new?problem_id=${problem.id})" target="_blank">${name || ""}</a><span class="text-gray-400 ml-1">${problem.grade}</span>`;

        new maplibregl.Popup({closeButton:false, focusAfterOpen: false, offset: [0, -8]})
        .setLngLat(coordinates)
        .setHTML(html)
        .addTo(this.map);
      });
    }

    this.map.on('mouseenter', ['contribute-problems','contribute-problems-texts'], () => {
      this.map.getCanvas().style.cursor = 'pointer';
    });
    this.map.on('mouseleave', ['contribute-problems','contribute-problems-texts'], () => {
      this.map.getCanvas().style.cursor = '';
    });

    this.map.on('click', ['contribute-problems','contribute-problems-texts'], (e) => {

      let group = e.features[0].properties

      const coordinates = e.features[0].geometry.coordinates.slice();
      var name = group.name
      if(this.localeValue == 'en' && group.nameEn) {
        name = group.nameEn
      }

      let problems = JSON.parse(group.problems)
      const html = problems.map(
        problem => `<div>
        <a href="/${this.localeValue}/mapping/problems/${problem.id}" target="_blank">${problem.name || ""}</a>
        <span class="text-gray-400 ml-1">${problem.grade}</span>
        <span class="text-gray-400 ml-1 font-semibold">(${problem.ascents})</span>
        </div>`
      ).join("");

      new maplibregl.Popup({closeButton:false, focusAfterOpen: false, offset: [0, -8]})
      .setLngLat(coordinates)
      .setHTML(html)
      .addTo(this.map);
    });

    this.map.on('mouseenter', ['circuit7a-problems','circuit7a-problems-texts'], () => {
      this.map.getCanvas().style.cursor = 'pointer';
    });
    this.map.on('mouseleave', ['circuit7a-problems','circuit7a-problems-texts'], () => {
      this.map.getCanvas().style.cursor = '';
    });

    this.map.on('click', ['circuit7a-problems','circuit7a-problems-texts'], (e) => {

      let problem = e.features[0].properties

      const coordinates = e.features[0].geometry.coordinates.slice();
      var name = problem.name
      if(this.localeValue == 'en' && problem.nameEn) {
        name = problem.nameEn
      }
      const html = `<a href="/${this.localeValue}/redirects/new?problem_id=${problem.id})" target="_blank">${name || ""}</a><span class="text-gray-400 ml-1">${problem.grade}</span>`;

      new maplibregl.Popup({closeButton:false, focusAfterOpen: false, offset: [0, -8]})
      .setLngLat(coordinates)
      .setHTML(html)
      .addTo(this.map);
    });

    this.map.on('mouseenter', 'pois', () => {
      if(this.map.getZoom() >= 12) {
        this.map.getCanvas().style.cursor = 'pointer';
      }
    });
    this.map.on('mouseleave', 'pois', () => {
      if(this.map.getZoom() >= 12) {
        this.map.getCanvas().style.cursor = '';
      }
    });

    this.map.on('click', 'pois', (e) => {
      if(this.map.getZoom() >= 12) {

        const coordinates = e.features[0].geometry.coordinates.slice();
        const html = `<a href="${e.features[0].properties.googleUrl}" target="_blank">${this.localeValue == 'fr' ? 'Voir sur Google' : 'See on Google'}</a>`;

        new maplibregl.Popup({closeButton:false, focusAfterOpen: false, offset: [0, -8]})
        .setLngLat(coordinates)
        .setHTML(html)
        .addTo(this.map);
      }
    });

    this.map.on('mouseenter', 'areas', () => {
      if(this.map.getZoom() < 15) {
        this.map.getCanvas().style.cursor = 'pointer';
      }
    });
    this.map.on('mouseleave', 'areas', () => {
      if(this.map.getZoom() < 15) {
        this.map.getCanvas().style.cursor = '';
      }
    });

    this.map.on('click', 'areas', (e) => {
      if(this.map.getZoom() < 15) {
        let props = e.features[0].properties
        this.flyToBounds([[props.southWestLon, props.southWestLat], [props.northEastLon, props.northEastLat]])
      }
    });

    this.map.on('mouseenter', 'areas-hulls', () => {
      if(this.map.getZoom() < 15) {
        this.map.getCanvas().style.cursor = 'pointer';
      }
    });
    this.map.on('mouseleave', 'areas-hulls', () => {
      if(this.map.getZoom() < 15) {
        this.map.getCanvas().style.cursor = '';
      }
    });

    this.map.on('click', 'areas-hulls', (e) => {
      if(this.map.getZoom() < 15) {
        let props = e.features[0].properties
        this.flyToBounds([[props.southWestLon, props.southWestLat], [props.northEastLon, props.northEastLat]])
      }
    });

    this.map.on('mouseenter', 'clusters', () => {
      if(this.map.getZoom() <= 12) {
        this.map.getCanvas().style.cursor = 'pointer';
      }
    });
    this.map.on('mouseleave', 'clusters', () => {
      if(this.map.getZoom() <= 12) {
        this.map.getCanvas().style.cursor = '';
      }
    });

    this.map.on('click', 'clusters', (e) => {
      if(this.map.getZoom() <= 12) {
        let props = e.features[0].properties
        this.flyToBounds([[props.southWestLon, props.southWestLat], [props.northEastLon, props.northEastLat]])
      }
    });
  }

  flyToBounds(bounds) {

    var cameraOptions = this.map.cameraForBounds(
      bounds
      ,
      {
        padding: {top: 20, bottom:100, left: 20, right: 20}
      }
    );

    cameraOptions.zoom = Math.max(15, cameraOptions.zoom)
    cameraOptions.speed = 2

    this.map.flyTo(cameraOptions)
  }

  // =========================================================
  // TODO: move the filters logic into its own controller
  // =========================================================

  didSelectFilter(event) {
    this.gradeRadioButton = event.target.value

    if(this.gradeRadioButton == "custom") {
      this.customGradePickerTarget.classList.remove("hidden")
    }
    else {
      this.customGradePickerTarget.classList.add("hidden")
    }
  }

  applyFilters() {
    this.filterCounterTarget.classList.remove("hidden")
    this.filterIconTarget.classList.add("hidden")

    var grades = []
    if(this.gradeRadioButton == "beginner") {
      grades = ["1a","1a+","1b","1b+","1c","1c+","2a","2a+","2b","2b+","2c","2c+","3a","3a+","3b","3b+","3c","3c+",]
    }
    else if(this.gradeRadioButton == "level4") {
      grades = ["4a","4a+","4b","4b+","4c","4c+"]
    }
    else if(this.gradeRadioButton == "level5") {
      grades = ["5a","5a+","5b","5b+","5c","5c+"]
    }
    else if(this.gradeRadioButton == "level6") {
      grades = ["6a","6a+","6b","6b+","6c","6c+"]
    }
    else if(this.gradeRadioButton == "level7") {
      grades = ["7a","7a+","7b","7b+","7c","7c+"]
    }
    else if(this.gradeRadioButton == "level8") {
      grades = ["8a","8a+","8b","8b+","8c","8c+"]
    }
    else if(this.gradeRadioButton == "custom") {
      let gradeMin = this.gradeMinTarget.value
      let gradeMax = this.gradeMaxTarget.value
      grades = this.allGrades.slice(this.allGrades.indexOf(gradeMin), this.allGrades.indexOf(gradeMax) + 2)
    }
    else {
      grades = this.allGrades
    }

    this.applyLayerFilter('problems', grades)
    this.applyLayerFilter('problems-texts', grades)
  }

  clearFilters() {
    this.gradeRadioButton == null

    this.filterCounterTarget.classList.add("hidden")
    this.filterIconTarget.classList.remove("hidden")

    this.gradeRadioButtonTargets.forEach(item => {
      item.checked = false
    })

    this.applyLayerFilter('problems', this.allGrades)
    this.applyLayerFilter('problems-texts', this.allGrades)
  }

  applyLayerFilter(layer, grades) {
    this.map.setFilter(layer, [
      'match',
      ['get', 'grade'],
      grades,
      true,
      false
    ]);
  }

  didSelectGradeMin() {
    let indexMin = this.allGrades.indexOf(this.gradeMinTarget.value)
    let indexMax = this.allGrades.indexOf(this.gradeMaxTarget.value)
    this.gradeMaxTarget.value = this.allGrades[Math.max(indexMin, indexMax)]
  }

  didSelectGradeMax() {
    let indexMin = this.allGrades.indexOf(this.gradeMinTarget.value)
    let indexMax = this.allGrades.indexOf(this.gradeMaxTarget.value)
    this.gradeMinTarget.value = this.allGrades[Math.min(indexMin, indexMax)]
  }

  // =========================================================


  // =========================================================
  // Hooks coming from search_controller
  // =========================================================

  gotoproblem(event) {
    this.map.flyTo({
      center: [event.detail.lon, event.detail.lat],
      zoom: 20,
      speed: 2
    });

    const coordinates = [event.detail.lon, event.detail.lat];
    const html = `<a href="/${this.localeValue}/redirects/new?problem_id=${event.detail.id}" target="_blank">${event.detail.name || ""}</a><span class="text-gray-400 ml-1">${event.detail.grade}</span>`;

    new maplibregl.Popup({closeButton:false, focusAfterOpen: false, offset: [0, -8]})
    .setLngLat(coordinates)
    .setHTML(html)
    .addTo(this.map);
  }

  gotoarea(event) {
    this.flyToBounds([[event.detail.south_west_lon, event.detail.south_west_lat], [event.detail.north_east_lon, event.detail.north_east_lat]])
  }
}
