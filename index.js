const path = require('path');
const express = require('express');
const uuid = require('uuid');
const WebSocket = require('ws');
const app = express();

app.use(require('express-fileupload')());

app.use('/static', express.static(path.resolve(__dirname, 'static')))
app.post('/upload', (req, res) => {
  const { image, audio } = req.files || {};
  if (image) {
    const filename = uuid.v4()+'.jpg';
    image.mv(path.resolve(__dirname,'static',filename)).then(() => {
      const url = `${req.protocol}://${req.headers.host}/static/${filename}`;
      res.send({ url });
    }).catch(err => res.status(500).send({ message: err.message }));

  } else if (audio) {
    if (!audio.mimetype.includes('webm')) {
      return res.status(400).send({ message: 'Audio mimetype must be webm' });
    }

    const filename = uuid.v4()+'.webm';
    audio.mv(path.resolve(__dirname,'static',filename)).then(() => {
      const url = `${req.protocol}://${req.headers.host}/static/${filename}`;
      res.send({ url });
    }).catch(err => res.status(500).send({message:err.message}));
  } else res.status(400).send({ message: 'Missing image/audio field' });
});

const server = app.listen(8080, () => console.log('Listening at port 8080'));

const RTC = new WebSocket.Server({ server });

/** @type {Map<string, Set<WebSocket>>} */
const rooms = new Map();

function id() {
  return ++id.last;
}
id.last = 0;

RTC.on('connection', (socket, request) => {
  let room = request.url && request.url.substr(1);
  if (room) {
    if (rooms.has(room)) {
      rooms.get(room).add(socket);
    } else {
      rooms.set(room, new Set([socket]));
    }
  } else {
    return socket.close();
  }

  socket.id = id();

  console.log(`WebSocket ${socket.id} connected on room: ${room}`);

  socket.on('message', data => {
    if (rooms.has(room)) {
      rooms.get(room).forEach(peer => {
        peer != socket && peer.send(data);
      });
    }
  });
  socket.on('close', () => {
    const leaveFrom = rooms.get(room);
    if (leaveFrom) {
      leaveFrom.delete(socket);
      if (!leaveFrom.size)
        rooms.delete(room);
      
      console.log(`WebSocket ${socket.id} disconnected from room: ${room}`);
    } else {
      console.log(`WebSocket ${socket.id} disconnected`);
    }
  });
});