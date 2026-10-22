import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { removeImage, setCover, type ImageEditResult } from '../services/itemImages.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function send(res: Response, r: ImageEditResult, message: string) {
   if (!r.ok) {
      return res.status(r.status).json({ success: false, ...(r.code ? { code: r.code } : {}), message: r.message });
   }
   return res.status(StatusCodes.OK).json({
      success: true,
      message,
      data: { images: r.images, valuation_status: r.valuation_status },
   });
}

function ids(req: Request): { id: string; imageId: string } | null {
   const id = String(req.params.id);
   const imageId = String(req.params.imageId);
   return UUID_RE.test(id) && UUID_RE.test(imageId) ? { id, imageId } : null;
}

/** DELETE /items/:id/images/:imageId */
export async function destroy(req: Request, res: Response) {
   const p = ids(req);
   if (!p) return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Photo not found.' });
   return send(res, await removeImage(p.id, p.imageId, req.userId as string), 'Photo removed.');
}

/** PATCH /items/:id/images/:imageId/primary */
export async function makePrimary(req: Request, res: Response) {
   const p = ids(req);
   if (!p) return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Photo not found.' });
   return send(res, await setCover(p.id, p.imageId, req.userId as string), 'Cover photo updated.');
}
