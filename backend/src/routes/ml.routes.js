import { Router } from 'express';

const router = Router();

const mlPredictions = new Map([
  ['E1', { edge_id: 'E1', probability: 0.12, label: 0, features: { cumulative_rainfall: 15, rate_of_change: 2.3 }, predicted_at: Date.now() }],
  ['E2', { edge_id: 'E2', probability: 0.35, label: 0, features: { cumulative_rainfall: 45, rate_of_change: 8.1 }, predicted_at: Date.now() }],
  ['E3', { edge_id: 'E3', probability: 0.08, label: 0, features: { cumulative_rainfall: 8, rate_of_change: 1.2 }, predicted_at: Date.now() }],
  ['E4', { edge_id: 'E4', probability: 0.72, label: 1, features: { cumulative_rainfall: 120, rate_of_change: 15.5 }, predicted_at: Date.now() }],
  ['E5', { edge_id: 'E5', probability: 0.15, label: 0, features: { cumulative_rainfall: 25, rate_of_change: 4.2 }, predicted_at: Date.now() }],
  ['E6', { edge_id: 'E6', probability: 0.22, label: 0, features: { cumulative_rainfall: 30, rate_of_change: 5.1 }, predicted_at: Date.now() }],
]);

router.post('/predict', (req, res) => {
  const { edge_id, features } = req.body;
  
  if (!edge_id) {
    return res.status(400).json({ 
      error: 'EDGE_ID_REQUIRED',
      message: 'edge_id is required' 
    });
  }
  
  const rainFactor = (features?.cumulative_rainfall || 50) / 200;
  const rateFactor = (features?.rate_of_change || 5) / 20;
  const elevation = features?.elevation_m || 10;
  const elevationFactor = Math.max(0, 1 - elevation / 100);
  
  const probability = Math.min(0.99, Math.max(0.01, (rainFactor * 0.5 + rateFactor * 0.3 + elevationFactor * 0.2)));
  const label = probability > 0.7 ? 1 : 0;
  
  const prediction = {
    edge_id,
    probability: Math.round(probability * 100) / 100,
    label,
    risk: probability > 0.7 ? 'high' : probability > 0.3 ? 'medium' : 'low',
    features: features || {},
    predicted_at: Date.now()
  };
  
  mlPredictions.set(edge_id, prediction);
  
  res.json({ success: true, prediction });
});

router.get('/predictions', (req, res) => {
  const predictions = Array.from(mlPredictions.values());
  
  res.json({ 
    success: true, 
    predictions,
    count: predictions.length
  });
});

export default router;
