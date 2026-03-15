// Standalone health check – no Nest/DB. Returns 200 so load balancers get a response even when DB fails.
module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).end(JSON.stringify({ status: 'ok', message: 'Schedley API is running' }));
};
