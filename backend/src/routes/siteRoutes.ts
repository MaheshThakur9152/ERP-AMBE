import { Router } from 'express';
import { SiteController } from '../controllers/siteController';

const router = Router();

router.get('/', SiteController.list);
router.get('/:id', SiteController.getById);
router.post('/', SiteController.create);
router.put('/:id', SiteController.update);
router.delete('/:id', SiteController.delete);

export default router;
