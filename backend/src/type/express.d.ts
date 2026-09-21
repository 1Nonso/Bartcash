import { JwtPayload } from '../utils/jwt'; // whatever type your access-token payload actually is

declare global {
   namespace Express {
      interface Request {
         user?: JwtPayload; // or however you shape { id, ... } on req.user
      }
   }
}

export {};
