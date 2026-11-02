(function () {
  'use strict';
  var AGENT_ID = 'agent_w5PMXktqgs2nfCTCC36KgK';
  var TOKEN_URL = 'https://xewxigpmvuxkuqtxhxha.supabase.co/functions/v1/cartesia-token';
  var button = document.getElementById('startVoice');
  var status = document.getElementById('statusMessage');
  var availability = document.getElementById('availability');
  var socket = null;
  var audioContext = null;
  var micStream = null;
  var processor = null;
  var source = null;
  var nextPlayTime = 0;
  if (!button) return;

  function setMessage(message, isError) {
    status.textContent = message;
    status.className = 'status-message' + (isError ? ' error' : '');
  }

  function base64FromInt16(input) {
    var bytes = new Uint8Array(input.buffer);
    var binary = '';
    for (var i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  function int16FromBase64(value) {
    var binary = atob(value);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Int16Array(bytes.buffer);
  }

  function floatToInt16(input) {
    var output = new Int16Array(input.length);
    for (var i = 0; i < input.length; i += 1) {
      var sample = Math.max(-1, Math.min(1, input[i]));
      output[i] = sample < 0 ? sample * 32768 : sample * 32767;
    }
    return output;
  }

  function playPcm(audio) {
    if (!audioContext) return;
    var pcm = int16FromBase64(audio);
    var buffer = audioContext.createBuffer(1, pcm.length, 44100);
    var channel = buffer.getChannelData(0);
    for (var i = 0; i < pcm.length; i += 1) channel[i] = pcm[i] / 32768;
    var node = audioContext.createBufferSource();
    node.buffer = buffer;
    node.connect(audioContext.destination);
    var startAt = Math.max(audioContext.currentTime, nextPlayTime);
    node.start(startAt);
    nextPlayTime = startAt + buffer.duration;
  }

  function stopVoice() {
    if (processor) processor.disconnect();
    if (source) source.disconnect();
    if (micStream) micStream.getTracks().forEach(function (track) { track.stop(); });
    if (socket && socket.readyState < 2) socket.close(1000, 'User ended session');
    processor = null; source = null; micStream = null; socket = null;
    if (audioContext && audioContext.state !== 'closed') audioContext.close();
    audioContext = null; nextPlayTime = 0;
    button.disabled = false;
    button.textContent = 'Start voice assistant';
    availability.textContent = 'Voice assistant ready';
    setMessage('Voice session ended. You can start another call whenever you need help.', false);
  }

  async function startVoice() {
    button.disabled = true;
    button.textContent = 'Connecting...';
    setMessage('Preparing a secure voice session…', false);
    var response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: AGENT_ID })
    });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok || !data.access_token) {
      var tokenError = new Error(data.error || 'The secure voice token could not be created.');
      tokenError.stage = 'token';
      throw tokenError;
    }
    availability.textContent = 'Secure token verified';

    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
    } catch (microphoneError) {
      microphoneError.stage = 'microphone';
      throw microphoneError;
    }
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
      await audioContext.resume();
    } catch (audioError) {
      audioError.stage = 'audio';
      throw audioError;
    }
    socket = new WebSocket('wss://api.cartesia.ai/v1/agents/websocket/' + encodeURIComponent(AGENT_ID) + '?access_token=' + encodeURIComponent(data.access_token) + '&cartesia_version=2026-08-14');
    socket.onopen = function () {
      socket.send(JSON.stringify({ type: 'session_create', audio: { input_format: 'pcm_44100', output_delivery: 'speaking_pace' } }));
    };
    socket.onmessage = function (event) {
      var message = JSON.parse(event.data);
      if (message.type === 'session_ready') {
        availability.textContent = 'Voice assistant is live';
        button.disabled = false;
        button.textContent = 'End voice assistant';
        setMessage('You are connected. Ask how to register or get help with the DailyGlo website.', false);
        source = audioContext.createMediaStreamSource(micStream);
        processor = audioContext.createScriptProcessor(4096, 1, 1);
        processor.onaudioprocess = function (audioEvent) {
          if (!socket || socket.readyState !== WebSocket.OPEN) return;
          socket.send(JSON.stringify({ type: 'audio_input', audio: base64FromInt16(floatToInt16(audioEvent.inputBuffer.getChannelData(0))) }));
        };
        source.connect(processor);
        processor.connect(audioContext.destination);
      } else if (message.type === 'audio_output') {
        playPcm(message.audio);
      } else if (message.type === 'audio_output_clear') {
        nextPlayTime = audioContext ? audioContext.currentTime : 0;
      } else if (message.type === 'turn_output_text_delta') {
        status.textContent = message.text || status.textContent;
      } else if (message.type === 'error') {
        setMessage(message.message || 'The voice session reported an error.', true);
      }
    };
    socket.onerror = function () { setMessage('The voice connection could not be completed. Please use the registration and login links below.', true); };
    socket.onclose = function () {
      if (socket) stopVoice();
    };
  }

  button.addEventListener('click', function () {
    if (socket && socket.readyState < 2) { stopVoice(); return; }
    startVoice().catch(function (error) {
      var stage = error && error.stage;
      stopVoice();
      if (stage === 'token') {
        setMessage('Secure voice token failed. Please check the Cartesia API key and Supabase Edge Function secret configuration.', true);
        availability.textContent = 'Token service error';
      } else if (stage === 'microphone' || (error && error.name === 'NotAllowedError')) {
        setMessage('Microphone permission was blocked. Allow microphone access for dailyglo.online, then try again.', true);
        availability.textContent = 'Microphone permission needed';
      } else if (stage === 'audio') {
        setMessage('This browser could not start audio. Try Chrome or Safari and allow microphone access.', true);
        availability.textContent = 'Browser audio unavailable';
      } else {
        setMessage('Voice connection failed before the call started. Please check your network or try again.', true);
        availability.textContent = 'Voice connection error';
      }
    });
  });
}());
