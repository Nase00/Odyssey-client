var app = require('./application.jsx')

function RouteSegments() {
  this.bikeId = null;
  this.offset = null;
  this.waypts = [];
  this.wayptsInfo = [];
  this.speedInterval = 1400;

  // Prevent MAX_WAYPOINTS_EXEEDED
  this.safeWaypts = [];
  this.makeSafeWaypts = function() {
    this.safeWaypts = [];
    for (var i = 1; i < this.waypts.length - 1; i++) {
      this.safeWaypts.push(
        this.waypts[i]
      );
    }
  };
  this.advanceRoute = function(trip) {
    if (this.waypts.length == 10) {
      this.waypts.shift();
      this.wayptsInfo.shift();
    }

    this.waypts.push({
      location: new google.maps.LatLng(trip.lat, trip.lng)
    });

    this.wayptsInfo.push({
      tripId: trip.trip_id,
      startTime: trip.start_time,
      stopTime: trip.stop_time,
      startLocation: trip.start_location,
      stopLocation: trip.stop_location,
      duration: trip.duration,
      latitude: trip.lat,
      longitude: trip.lng
    })

    this.drawRoute();
  };
};

module.exports = RouteSegments