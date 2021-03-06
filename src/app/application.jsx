// Initialize dependencies
var React = require('react/addons')
		, https = require('https')
    , options = require('./config/options')
    , RouteSegments = require('./route-segments')
    // , routeControl = require('./route-controller.jsx')
    , RoutesInfoContainer = require('./components/routes-info-container.jsx')
    , ErrorContainer = require('./components/error-container.jsx')
    , BikeSearch = require('./components/bike-search.jsx')
    , FaqPopup = require('./components/faq.jsx')
    , ReactCSSTransitionGroup = React.addons.CSSTransitionGroup

React.render(<FaqPopup/>, document.getElementById("faq-anchor"))
React.render(<BikeSearch/>, document.getElementById("bike-anchor"))

// Initialize map
var coordinates = []
    , directionsDisplay = new google.maps.DirectionsRenderer(options.render)
    , directionsService = new google.maps.DirectionsService()
    , map = new google.maps.Map(document.getElementById('map'), options.map)
    , counter = 0

// Initialize StreetView Dependencies
var streetView = new google.maps.StreetViewPanorama(document.getElementById('streetview'), options.streetView)
directionsDisplay.setMap(map)

RouteSegments.prototype.drawRoute = function () {
  this.makeSafeWaypts()
  var destination = routeSegments.waypts[routeSegments.waypts.length-1].location,
      request = {
        origin: this.waypts[0].location,
        destination: destination,
        waypoints: this.safeWaypts,
        travelMode: google.maps.TravelMode.BICYCLING
      }
  directionsService.route(request, function(response, status) {
    clearInterval(rideInterval)
    // console.log("Google response status: " + status)
    if (status == google.maps.DirectionsStatus.OK) {
      routeControl.drawPoly(response)
      routeControl.animate()
      directionsDisplay.setDirections(response)
      React.render(<span />, document.getElementById('error-container'))
      React.render(<RoutesInfoContainer tripsInfo={routeSegments.wayptsInfo} />, document.getElementById('routes-display-container'))
    } else {
      React.render(<ErrorContainer data={[{message: "Waiting on Google", loadAnim: true}]} />, document.getElementById('error-container'))
    }
  })
}

function RouteControl() {
  var self = this
  this.getTrip = function() {
    routeSegments.offset += 1
    https.get('https://divvy-odyssey.herokuapp.com/trip_for/' + routeSegments.bikeId + '/after/' + routeSegments.offset, function(response) {
		  response.on('data', function(data) {
		  	data = JSON.parse(data)
		    if (data.status === 200) {
          routeSegments.advanceRoute(data)
        } else if (data.status === 510) {
        	self.stopTraverse()
          React.render(<ErrorContainer data={[{message: "Bike not found, try another!", loadAnim: false}]} />, document.getElementById('error-container'))
        } else if (data.status === 404) {
          self.stopTraverse()
          React.render(<ErrorContainer data={[{message: "That's every trip in the database!", loadAnim: false}]} />, document.getElementById('error-container'))
        }
		  })
		}).on('error', function(error) {
		  console.error(error)
		})
  },
  this.stopTraverse = function() {
    clearInterval(rideInterval)
    intervalId = 0
    directionsDisplay.set('directions', null)
    map.panTo(options.Chicago)
    streetView.setPosition(options.Chicago)
    React.render(<span />, document.getElementById('routes-display-container'))
    React.render(<span />, document.getElementById('error-container'))
  },
  this.drawPoly = function(result) {
    var routesArray = result.routes[0].overview_path
    poly.setMap(map)
    poly.setPath(routesArray)
  },
  this.loading = function() {
    React.render(<ErrorContainer data={[{message: "Loading trips for bike #" + routeSegments.bikeId, loadAnim: true}]} />, document.getElementById('error-container'))
  },
  this.fixate = function(location) {
    map.panTo(location)
    streetView.setPosition(location)
    var heading = google.maps.geometry.spherical.computeHeading(streetView.location.latLng, location),
        pov = streetView.getPov()
    pov.heading = heading
    streetView.setPov(pov)
  },
  this.animate = function() {
    rideInterval = window.setInterval(function() { 
      var location = poly.getPath().getAt(counter)
      if (counter >= poly.getPath().length - 1) {
        window.clearInterval(rideInterval)
        self.getTrip()
      } else {
        interpolatePath = google.maps.geometry.spherical.interpolate(poly.getPath().getAt(counter),poly.getPath().getAt(counter + 1),counter/250)
        self.fixate(interpolatePath)
        self.fixate(location)
        counter++
      }
    }, routeSegments.speedInterval)
  },
  this.initiate = function() {
    React.render(<span />, document.getElementById('routes-display-container'))
    routeSegments.offset = 0
    this.getTrip()
    map.setZoom(15)
    this.loading()
  }
}

// Initialize control dependencies
var routeControl = new RouteControl,
    routeSegments = new RouteSegments,
    routeInterval,
    rideInterval,
    polyOptions = {
          path: [],
          geodesic: true,
          strokeColor: '#00a9ff',
          strokeOpacity: 0.25,
          strokeWeight: 3
        },
    poly = new google.maps.Polyline(polyOptions),
    interpolatePath

map.setStreetView(streetView)

// Reset streetview if it gets pushed off an available path
function removeListener() {
  google.maps.event.removeListener(streetViewListener)
}
var resetCounter = 0,
    streetViewListener = google.maps.event.addListener(streetView, 'visible_changed', function() {
      if (resetCounter <= 10 && !streetView.getVisible()) {
        resetCounter++
        streetView.setVisible()
        routeControl.fixate(routeSegments.waypts[routeSegments.waypts.length - 1])
      } else {
        resetCounter = 0
      }
    })

var MapControlContainer = React.createClass({
  getInitialState: function() {
    return {
      mounted: false,
      traversing: false,
      paused: false,
      speedier: false
    }
  },
  componentDidMount: function() {
    this.setState({
      mounted: true
    })
  },
  startTraverse: function() {
    routeSegments.bikeId = document.getElementById('bike-id-input').value
    if (routeSegments.bikeId) {
      this.setState({traversing: !this.state.traversing})
      routeControl.initiate()
    } else {
      React.render(<ErrorContainer data={[{message: "Please enter a bike id", loadAnim: false}]} />, document.getElementById('error-container'))
    }
  },
  startRandomTraverse: function() {
    this.setState({traversing: !this.state.traversing})
    routeSegments.bikeId = Math.floor(Math.random() * (3000-1) + 1)
    routeControl.initiate()
  },
  stopTraverse: function() {
    routeSegments = new RouteSegments
    counter = 0
    poly.setMap(null)
    clearInterval(rideInterval)
    this.setState({traversing: !this.state.traversing})
    this.setState({paused: false, speedier: false})
    routeControl.stopTraverse()
    map.setZoom(12)
  },
  handleInterval: function() {
    this.setState({paused: !this.state.paused})
    if (!this.state.paused) {
      clearInterval(rideInterval)
      React.render(<span />, document.getElementById('error-container'))
    } else {
      routeControl.animate()
    }
  },
  changeSpeed: function() {
    if (!this.state.paused) {
      this.setState({speedier: !this.state.speedier})

      clearInterval(rideInterval)
      if (this.state.speedier) {
        routeSegments.speedInterval = 1400
      } else {
        routeSegments.speedInterval = 600
      }
      routeControl.animate()
    }
  },
  render: function() {
    var initiateButtons =
        <div key="initial-buttons" id="initial-buttons">
          <p className="click-through">{"Follow a bike"}</p>
          <input id="bike-id-input" className="map-control text-field" type="text" autofocus="true" autoComplete="off" placeholder="Enter ID" />
          <input id="start-traverse" className="map-control button-green" onClick={this.startTraverse} type="submit" target="remote" value="Begin" />
          <p className="click-through">or</p>
          <input id="start-traverse" className="map-control button-green" onClick={this.startRandomTraverse} type="submit" target="remote" value="Random" />
        </div>,
      continueButton =
        <input key="continue-traverse" id="continue-traverse" className="map-control button-green" onClick={this.handleInterval} type="submit" target="remote" value="Continue" />,
      pauseButton =
        <input key="pause-traverse" id="pause-traverse" className="map-control button-blue" onClick={this.handleInterval} type="submit" target="remote" value="Pause" />,
      stopButton =
        <input key="stop-traverse" id="stop-traverse" className="map-control button-red" onClick={this.stopTraverse} type="submit" target="remote" value="Stop" />,
      currentBike =
        <div key="current-bike" id="info-left">Following bike #{routeSegments.bikeId}</div>,
      speedUp =
        <input key="speed-up" id="speed-up" className="map-control button-green" onClick={this.changeSpeed} type="submit" target="remote" value="Fast" />,
      speedDown =
        <input key="speed-down" id="speed-down" className="map-control button-blue" onClick={this.changeSpeed} type="submit" target="remote" value="Slow" />

    var buttonArray
    var key = 0

    if (!this.state.traversing) {
      buttonArray = [initiateButtons]
    } else if (this.state.paused) {
      buttonArray = [currentBike, stopButton, continueButton]
    } else {
      buttonArray = [currentBike, stopButton, pauseButton]
    }

    if (this.state.speedier && this.state.traversing) {
      buttonArray.push(speedDown)
    } else if (this.state.traversing) {
      buttonArray.push(speedUp)
    }

    buttonArray.map(function (button) {
      return (
          <MapControl key={key++} data={button} />
        )
    }.bind(this))

    return (
      <div>
        <ReactCSSTransitionGroup transitionName="buttons">
          <MapControl key={key++} data={buttonArray} />
        </ReactCSSTransitionGroup>
      </div>
    )
  }
})
var MapControl = React.createClass({
  getInitialState: function() {
    return {
      mounted: false
    }
  },
  render: function() {
    return (
      <div id="hold-buttons">{this.props.data}</div>
    )
  }
})

React.render(<MapControlContainer />, document.getElementById('bike-control-container'))

module.exports = {
  map: map
  , streetView: streetView
  , controller: routeControl
  , model: routeSegments
  // , rideInterval: rideInterval
}