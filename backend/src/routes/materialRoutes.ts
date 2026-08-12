import { Router } from 'express';
import { MaterialController } from '../controllers/materialController';

const router = Router();

router.get('/', MaterialController.list);
router.post('/', MaterialController.create);
router.put('/:id', MaterialController.update);
router.delete('/:id', MaterialController.delete);

export default router;
