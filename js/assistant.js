(function () {
  'use strict';
  var button = document.getElementById('startVoice');
  var status = document.getElementById('statusMessage');
  var availability = document.getElementById('availability');
  if (!button) return;

  function setMessage(message, isError) {
    status.textContent = message;
    status.className = 'status-message' + (isError ? ' error' : '');
  }

  button.addEventListener('click', async function () {
    button.disabled = true;
    button.textContent = 'Preparing secure voice session...';
    setMessage('Connecting to the secure voice service…', false);
    try {
      var response = await fetch('https://xewxigpmvuxkuqtxhxha.supabase.co/functions/v1/cartesia-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: 'agent_w5PMXktqgs2nfCTCC36KgK' })
      });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(data.error || 'Voice service is not configured yet.');
      if (!data.access_token) throw new Error('Voice service returned no access token.');
      // The token endpoint is ready. The Cartesia browser audio client can use data.access_token.
      setMessage('Secure token received. The audio client will start here after the Cartesia key is connected.', false);
      availability.textContent = 'Voice service connected';
    } catch (error) {
      setMessage('Voice assistant is displayed and ready, but the Cartesia API key still needs to be added on the server.', true);
      availability.textContent = 'Waiting for secure API key';
    } finally {
      button.disabled = false;
      button.textContent = 'Start voice assistant';
    }
  });
}());
