import { Router } from 'express';
import { renderArchitectureDiagramRequest } from '../services/architectureDiagramEndpoint.js';

const router = Router();

router.post('/render', async (req, res, next) => {
  try {
    res.json(await renderArchitectureDiagramRequest(req.body));
  } catch (err) {
    if (err.body) return res.status(err.status || 500).json(err.body);
    next(err);
  }
});

export default router;
