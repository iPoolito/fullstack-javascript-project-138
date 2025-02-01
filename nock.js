import fetch from 'node-fetch'; // Asegúrate de que esté instalado
import nock from 'nock';

nock.recorder.rec({
  output_objects: true,
  logging: console.log, // Registrar solicitudes
});

const scope = nock('https://example.com', {
  reqheaders: {
    accept: '*/*',
    'user-agent': /fetch|axios/i,
  },
})
  .get('/')
  .reply(200, '<html><head><title>Test</title></head><body>Test page</body></html>');

fetch('https://example.com')
  .then((response) => response.text())
  .then((body) => {
    console.log('Response body:', body); // Mostrar contenido de la respuesta
    console.log('Is Nock done?', scope.isDone()); // Confirmar si Nock interceptó
    const recordedRequests = nock.recorder.play();
    console.log('Recorded requests:', JSON.stringify(recordedRequests, null, 2));
  })
  .catch((error) => console.error('Error:', error))
  .finally(() => {
    nock.recorder.clear();
    nock.cleanAll();
  });
