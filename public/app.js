mdc.ripple.MDCRipple.attachTo(document.querySelector('.mdc-button'));

const configuration = {
  iceServers: [
    {
      urls: [
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
      ],
    },
  ],
  iceCandidatePoolSize: 10,
};


let localStream = null;

let connection1 = {
 peerConnection : null,

 remoteStream : null,
 roomDialog : null,
 roomId : null
}

let connection2 = {
 peerConnection : null,
 remoteStream : null,
 roomDialog : null,
 roomId : null
}


function init() {
  document.querySelector('#cameraBtn').addEventListener('click', openUserMedia);
  document.querySelector('#hangupBtn').addEventListener('click', hangUp);
  document.querySelector('#createBtn').addEventListener('click', createRoom);
  document.querySelector('#joinBtn').addEventListener('click', joinRoom);
  document.querySelector('#createBtn2').addEventListener('click', createSecondRoom);
  document.querySelector('#joinBtn2').addEventListener('click', joinSecondRoom);
  document.querySelector('#hangupBtn2').addEventListener('click', hangUpSecondRoom);
  connection1.roomDialog = new mdc.dialog.MDCDialog(document.querySelector('#room-dialog'));
  connection2.roomDialog = new mdc.dialog.MDCDialog(document.querySelector('#room-dialog2'));
}

async function createRoom() {
  document.querySelector('#createBtn').disabled = true;
  document.querySelector('#joinBtn').disabled = true;
  const db = firebase.firestore();
  const roomRef = await db.collection('rooms').doc();

  console.log('Create connection1.peerConnection with configuration: ', configuration);
  connection1.peerConnection = new RTCPeerConnection(configuration);

  registerPeerConnectionListeners();

  localStream.getTracks().forEach(track => {
    connection1.peerConnection.addTrack(track, localStream);
  });

  // Code for collecting ICE candidates below
  const callerCandidatesCollection = roomRef.collection('callerCandidates');

  connection1.peerConnection.addEventListener('icecandidate', event => {
    if (!event.candidate) {
      console.log('Got final candidate!');
      return;
    }
    console.log('Got candidate: ', event.candidate);
    callerCandidatesCollection.add(event.candidate.toJSON());
  });
  // Code for collecting ICE candidates above

  // Code for creating a room below
  const offer = await connection1.peerConnection.createOffer();
  await connection1.peerConnection.setLocalDescription(offer);
  console.log('Created offer:', offer);

  const roomWithOffer = {
    'offer': {
      type: offer.type,
      sdp: offer.sdp,
    },
  };
  await roomRef.set(roomWithOffer);
  connection1.roomId = roomRef.id;
  console.log(`New room created with SDP offer. Room ID: ${roomRef.id}`);
  document.querySelector(
      '#currentRoom').innerText = `Current room is ${roomRef.id} - You are the caller!`;
  // Code for creating a room above

  connection1.peerConnection.addEventListener('track', event => {
    console.log('Got remote track:', event.streams[0]);
    event.streams[0].getTracks().forEach(track => {
      console.log('Add a track to the connection1.remoteStream:', track);
      connection1.remoteStream.addTrack(track);
    });
  });

  // Listening for remote session description below
  roomRef.onSnapshot(async snapshot => {
    const data = snapshot.data();
    if (!connection1.peerConnection.currentRemoteDescription && data && data.answer) {
      console.log('Got remote description: ', data.answer);
      const rtcSessionDescription = new RTCSessionDescription(data.answer);
      await connection1.peerConnection.setRemoteDescription(rtcSessionDescription);
    }
  });
  // Listening for remote session description above

  // Listen for remote ICE candidates below
  roomRef.collection('calleeCandidates').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(async change => {
      if (change.type === 'added') {
        let data = change.doc.data();
        console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
        await connection1.peerConnection.addIceCandidate(new RTCIceCandidate(data));
      }
    });
  });
  // Listen for remote ICE candidates above
}

function joinRoom() {
  document.querySelector('#createBtn').disabled = true;
  document.querySelector('#joinBtn').disabled = true;

  document.querySelector('#confirmJoinBtn').
      addEventListener('click', async () => {
        connection1.roomId = document.querySelector('#room-id').value;
        console.log('Join room: ', connection1.roomId);
        document.querySelector(
            '#currentRoom').innerText = `Current room is ${connection1.roomId} - You are the callee!`;
        await joinRoomById(connection1.roomId);
      }, {once: true});
  connection1.roomDialog.open();
}

async function joinRoomById(roomId) {
  const db = firebase.firestore();
  console.log(db);
  const roomRef = db.collection('rooms').doc(`${roomId}`);
  const roomSnapshot = await roomRef.get();
  console.log('Got room:', roomSnapshot.exists);

  if (roomSnapshot.exists) {
    console.log('Create connection1.peerConnection with configuration: ', configuration);
    connection1.peerConnection = new RTCPeerConnection(configuration);
    registerPeerConnectionListeners();
    localStream.getTracks().forEach(track => {
      connection1.peerConnection.addTrack(track, localStream);
    });

    // Code for collecting ICE candidates below
    const calleeCandidatesCollection = roomRef.collection('calleeCandidates');
    connection1.peerConnection.addEventListener('icecandidate', event => {
      if (!event.candidate) {
        console.log('Got final candidate!');
        return;
      }
      console.log('Got candidate: ', event.candidate);
      calleeCandidatesCollection.add(event.candidate.toJSON());
    });
    // Code for collecting ICE candidates above

    connection1.peerConnection.addEventListener('track', event => {
      console.log('Got remote track:', event.streams[0]);
      event.streams[0].getTracks().forEach(track => {
        console.log('Add a track to the connection1.remoteStream:', track);
        connection1.remoteStream.addTrack(track);
      });
    });

    // Code for creating SDP answer below
    const offer = roomSnapshot.data().offer;
    console.log('Got offer:', offer);
    await connection1.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await connection1.peerConnection.createAnswer();
    console.log('Created answer:', answer);
    await connection1.peerConnection.setLocalDescription(answer);

    const roomWithAnswer = {
      answer: {
        type: answer.type,
        sdp: answer.sdp,
      },
    };
    await roomRef.update(roomWithAnswer);
    // Code for creating SDP answer above

    // Listening for remote ICE candidates below
    roomRef.collection('callerCandidates').onSnapshot(snapshot => {
      snapshot.docChanges().forEach(async change => {
        if (change.type === 'added') {
          let data = change.doc.data();
          console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
          await connection1.peerConnection.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
    // Listening for remote ICE candidates above
  }
}

async function createSecondRoom() {
  document.querySelector('#createBtn2').disabled = true;
  document.querySelector('#joinBtn2').disabled = true;
  const db = firebase.firestore();
  const roomRef = await db.collection('rooms').doc();

  console.log('Create connection2.peerConnection with configuration: ', configuration);
  connection2.peerConnection = new RTCPeerConnection(configuration);

  registerPeerConnectionListeners();

  localStream.getTracks().forEach(track => {
    connection2.peerConnection.addTrack(track, localStream);
  });

  // Code for collecting ICE candidates below
  const callerCandidatesCollection = roomRef.collection('callerCandidates');

  connection2.peerConnection.addEventListener('icecandidate', event => {
    if (!event.candidate) {
      console.log('Got final candidate!');
      return;
    }
    console.log('Got candidate: ', event.candidate);
    callerCandidatesCollection.add(event.candidate.toJSON());
  });
  // Code for collecting ICE candidates above

  // Code for creating a room below
  const offer = await connection2.peerConnection.createOffer();
  await connection2.peerConnection.setLocalDescription(offer);
  console.log('Created offer:', offer);

  const roomWithOffer = {
    'offer': {
      type: offer.type,
      sdp: offer.sdp,
    },
  };
  await roomRef.set(roomWithOffer);
  connection2.roomId = roomRef.id;
  console.log(`New room created with SDP offer. Room ID: ${roomRef.id}`);
  document.querySelector(
      '#currentRoom2').innerText = `Second room is ${roomRef.id} - You are the caller!`;
  // Code for creating a room above

  connection2.peerConnection.addEventListener('track', event => {
    console.log('Got remote track:', event.streams[0]);
    event.streams[0].getTracks().forEach(track => {
      console.log('Add a track to the connection2.remoteStream:', track);
      connection2.remoteStream.addTrack(track);
    });
  });

  // Listening for remote session description below
  roomRef.onSnapshot(async snapshot => {
    const data = snapshot.data();
    if (!connection2.peerConnection.currentRemoteDescription && data && data.answer) {
      console.log('Got remote description: ', data.answer);
      const rtcSessionDescription = new RTCSessionDescription(data.answer);
      await connection2.peerConnection.setRemoteDescription(rtcSessionDescription);
    }
  });
  // Listening for remote session description above

  // Listen for remote ICE candidates below
  roomRef.collection('calleeCandidates').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(async change => {
      if (change.type === 'added') {
        let data = change.doc.data();
        console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
        await connection2.peerConnection.addIceCandidate(new RTCIceCandidate(data));
      }
    });
  });
  // Listen for remote ICE candidates above
}

function joinSecondRoom() {
  document.querySelector('#createBtn2').disabled = true;
  document.querySelector('#joinBtn2').disabled = true;

  document.querySelector('#confirmJoinBtn2').
      addEventListener('click', async () => {
        connection2.roomId = document.querySelector('#room-id-2').value;
        console.log('Join room: ', connection2.roomId);
        document.querySelector(
            '#currentRoom2').innerText = `Second room is ${connection2.roomId} - You are the callee!`;
        await joinSecondRoomById(connection2.roomId);
      }, {once: true});
  connection2.roomDialog.open();
  
}

async function joinSecondRoomById(roomId) {
  const db = firebase.firestore();
  console.log(db);
  const roomRef = db.collection('rooms').doc(`${roomId}`);
  const roomSnapshot = await roomRef.get();
  console.log('Got room:', roomSnapshot.exists);

  if (roomSnapshot.exists) {
    console.log('Create connection2.peerConnection with configuration: ', configuration);
    connection2.peerConnection = new RTCPeerConnection(configuration);
    registerPeerConnectionListeners();
    localStream.getTracks().forEach(track => {
      connection2.peerConnection.addTrack(track, localStream);
    });

    // Code for collecting ICE candidates below
    const calleeCandidatesCollection = roomRef.collection('calleeCandidates');
    connection2.peerConnection.addEventListener('icecandidate', event => {
      if (!event.candidate) {
        console.log('Got final candidate!');
        return;
      }
      console.log('Got candidate: ', event.candidate);
      calleeCandidatesCollection.add(event.candidate.toJSON());
    });
    // Code for collecting ICE candidates above

    connection2.peerConnection.addEventListener('track', event => {
      console.log('Got remote track:', event.streams[0]);
      event.streams[0].getTracks().forEach(track => {
        console.log('Add a track to the connection2.remoteStream:', track);
        connection2.remoteStream.addTrack(track);
      });
    });

    // Code for creating SDP answer below
    const offer = roomSnapshot.data().offer;
    console.log('Got offer:', offer);
    await connection2.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await connection2.peerConnection.createAnswer();
    console.log('Created answer:', answer);
    await connection2.peerConnection.setLocalDescription(answer);

    const roomWithAnswer = {
      answer: {
        type: answer.type,
        sdp: answer.sdp,
      },
    };
    await roomRef.update(roomWithAnswer);
    // Code for creating SDP answer above

    // Listening for remote ICE candidates below
    roomRef.collection('callerCandidates').onSnapshot(snapshot => {
      snapshot.docChanges().forEach(async change => {
        if (change.type === 'added') {
          let data = change.doc.data();
          console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
          await connection2.peerConnection.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
    // Listening for remote ICE candidates above
  }
}

async function openUserMedia(e) {
  const stream = await navigator.mediaDevices.getUserMedia(
      {video: true, audio: true});
  document.querySelector('#localVideo').srcObject = stream;
  localStream = stream;
  connection1.remoteStream = new MediaStream();
  document.querySelector('#remoteVideo').srcObject = connection1.remoteStream;
  connection2.remoteStream = new MediaStream();
  document.querySelector('#remoteAudioSecondConnection').srcObject = connection2.remoteStream;

  console.log('Stream:', document.querySelector('#localVideo').srcObject);
  document.querySelector('#cameraBtn').disabled = true;
  document.querySelector('#joinBtn').disabled = false;
  document.querySelector('#createBtn').disabled = false;
  document.querySelector('#hangupBtn').disabled = false;
  document.querySelector('#joinBtn2').disabled = false;
  document.querySelector('#createBtn2').disabled = false;
  document.querySelector('#hangupBtn2').disabled = false;
}

async function hangUp(e) {
  const tracks = document.querySelector('#localVideo').srcObject.getTracks();
  tracks.forEach(track => {
    console.log(track);
    track.stop();
  });

  if (connection1.remoteStream) {
    connection1.remoteStream.getTracks().forEach(track => track.stop());
  }

  if (connection1.peerConnection) {
    connection1.peerConnection.close();
  }

  document.querySelector('#localVideo').srcObject = null;
  document.querySelector('#remoteVideo').srcObject = null;
  document.querySelector('#cameraBtn').disabled = false;
  document.querySelector('#joinBtn').disabled = true;
  document.querySelector('#createBtn').disabled = true;
  document.querySelector('#hangupBtn').disabled = true;
  document.querySelector('#currentRoom').innerText = '';

  // Delete room on hangup
  if (connection1.roomId) {
    const db = firebase.firestore();
    const roomRef = db.collection('rooms').doc(connection1.roomId);
    const calleeCandidates = await roomRef.collection('calleeCandidates').get();
    calleeCandidates.forEach(async candidate => {
      await candidate.ref.delete();
    });
    const callerCandidates = await roomRef.collection('callerCandidates').get();
    callerCandidates.forEach(async candidate => {
      await candidate.ref.delete();
    });
    await roomRef.delete();
  }

  document.location.reload(true);
}

async function hangUpSecondRoom(e) {
  const tracks = document.querySelector('#localVideo').srcObject.getTracks();
  tracks.forEach(track => {
    console.log(track);
    track.stop();
  });

  if (connection2.remoteStream) {
    connection2.remoteStream.getTracks().forEach(track => track.stop());
  }

  if (connection2.peerConnection) {
    connection2.peerConnection.close();
  }

  document.querySelector('#localVideo').srcObject = null;
  document.querySelector('#remoteAudioSecondConnection').srcObject = null;
  document.querySelector('#cameraBtn').disabled = false;
  document.querySelector('#joinBtn2').disabled = true;
  document.querySelector('#createBtn2').disabled = true;
  document.querySelector('#hangupBtn2').disabled = true;
  document.querySelector('#currentRoom2').innerText = '';

  // Delete room on hangup
  if (connection2.roomId) {
    const db = firebase.firestore();
    const roomRef = db.collection('rooms').doc(connection2.roomId);
    const calleeCandidates = await roomRef.collection('calleeCandidates').get();
    calleeCandidates.forEach(async candidate => {
      await candidate.ref.delete();
    });
    const callerCandidates = await roomRef.collection('callerCandidates').get();
    callerCandidates.forEach(async candidate => {
      await candidate.ref.delete();
    });
    await roomRef.delete();
  }

  document.location.reload(true);
}



function registerPeerConnectionListeners() {
  if(connection1.peerConnection){
  connection1.peerConnection.addEventListener('icegatheringstatechange', () => {
    console.log(
        `ICE gathering state changed: ${connection1.peerConnection.iceGatheringState}`);
  });

  connection1.peerConnection.addEventListener('connectionstatechange', () => {
    console.log(`Connection state change: ${connection1.peerConnection.connectionState}`);
  });

  connection1.peerConnection.addEventListener('signalingstatechange', () => {
    console.log(`Signaling state change: ${connection1.peerConnection.signalingState}`);
  });

  connection1.peerConnection.addEventListener('iceconnectionstatechange ', () => {
    console.log(
        `ICE connection state change: ${connection1.peerConnection.iceConnectionState}`);
  });
}

if(connection2.peerConnection){
  connection2.peerConnection.addEventListener('icegatheringstatechange', () => {
    console.log(
        `ICE gathering state changed: ${connection1.peerConnection.iceGatheringState}`);
  });

  connection2.peerConnection.addEventListener('connectionstatechange', () => {
    console.log(`Connection state change: ${connection1.peerConnection.connectionState}`);
  });

  connection2.peerConnection.addEventListener('signalingstatechange', () => {
    console.log(`Signaling state change: ${connection1.peerConnection.signalingState}`);
  });

  connection2.peerConnection.addEventListener('iceconnectionstatechange ', () => {
    console.log(
        `ICE connection state change: ${connection1.peerConnection.iceConnectionState}`);
  });
}
}

init();