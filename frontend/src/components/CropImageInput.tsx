import { useRef, useState } from 'react';
import ImageCropModal from './ImageCropModal';

interface Props {
  onFile: (file: File) => void;
  aspectRatio?: number;    // 1 = square, 16/9 = wide, default 1
  loading?: boolean;
  label?: string;
  cropTitle?: string;
  className?: string;
}

/**
 * Drop-in image-file input with built-in crop.
 * Renders a styled upload button. When user picks a file, the crop modal
 * opens. After confirming the crop, `onFile(croppedFile)` is called.
 */
export default function CropImageInput({
  onFile,
  aspectRatio = 1,
  loading = false,
  label = 'Upload Image',
  cropTitle = 'Crop Image',
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [rawFile, setRawFile] = useState<File | null>(null);

  const handleFileChange = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      setCropSrc(e.target?.result as string);
      setRawFile(file);
    };
    reader.readAsDataURL(file);
    // Reset input so the same file can be re-selected
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDone = (croppedFile: File) => {
    setCropSrc(null);
    setRawFile(null);
    onFile(croppedFile);
  };

  const handleCancel = () => {
    setCropSrc(null);
    setRawFile(null);
  };

  return (
    <>
      <label
        className={
          className ??
          'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200 hover:bg-blue-100 transition cursor-pointer'
        }
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={e => handleFileChange(e.target.files?.[0])}
        />
        {loading ? 'Uploading…' : label}
      </label>

      {cropSrc && rawFile && (
        <ImageCropModal
          imageSrc={cropSrc}
          originalFile={rawFile}
          aspectRatio={aspectRatio}
          title={cropTitle}
          onDone={handleDone}
          onCancel={handleCancel}
        />
      )}
    </>
  );
}
