(function() {
  var socket = io('http://localhost:3000');

  socket.on('lint', function(data) {
    data.forEach(function(e) {
      console.warn(e);
    });
  });
})();
