/**
 * Add a picked image to a multipart form.
 *
 * Native: React Native's { uri, name, type } file object, unchanged. Web:
 * that object would be sent as the text "[object Object]", so the picked
 * image (a blob: or data: URL) is read into a Blob first.
 */

import { Platform } from "react-native";

export interface PickedImage {
  uri: string;
  name: string;
  type: string;
}

export async function appendImage(form: FormData, field: string, img: PickedImage): Promise<void> {
  if (Platform.OS === "web") {
    const blob = await (await fetch(img.uri)).blob();
    form.append(field, blob, img.name);
    return;
  }
  form.append(field, { uri: img.uri, name: img.name, type: img.type } as any);
}
