<?php
declare(strict_types=1);

/**
 * Almacén de comprobantes. Reglas de seguridad:
 *  - tipo REAL por contenido (finfo + firma), nunca por la extensión o el MIME que declara el cliente;
 *  - la extensión guardada sale del tipo detectado (un "recibo.php" con contenido PDF se guarda como .pdf);
 *  - nombre aleatorio; el cliente no controla ninguna parte de la ruta (sin path traversal);
 *  - se guarda una CLAVE relativa validada por regex, no una ruta absoluta;
 *  - la descarga pasa por un endpoint autorizado: los archivos no se sirven directamente.
 * UPLOAD_DIR debería estar FUERA del directorio web. Si no es posible, storage/.htaccess niega todo acceso.
 */
final class FileStore
{
    private const TYPES = [
        'application/pdf' => 'pdf',
        'image/jpeg'      => 'jpg',
        'image/png'       => 'png',
        'image/webp'      => 'webp',
    ];
    private const KEY_RE = '#^\d{4}/\d{2}/[a-f0-9]{32}\.(pdf|jpg|png|webp)$#';

    private static function root(): string
    {
        $dir = (string) env('UPLOAD_DIR', '');
        if ($dir === '') $dir = __DIR__ . '/../../storage/receipts';
        elseif (!preg_match('#^([A-Za-z]:)?[\\\\/]#', $dir)) $dir = __DIR__ . '/../' . $dir;   // relativo a api/v1
        return rtrim($dir, '/\\');
    }

    /** @return string clave relativa para guardar en la base */
    public static function saveUpload(array $file): string
    {
        if (!isset($file['error'], $file['tmp_name'], $file['size']) || is_array($file['error'])) Response::error('Archivo inválido', 400);
        if ($file['error'] !== UPLOAD_ERR_OK) Response::error('Error al subir el archivo', 400);

        $max = (int) env('UPLOAD_MAX_MB', 5) * 1024 * 1024;
        if ($file['size'] <= 0 || $file['size'] > $max) Response::error('El archivo debe pesar entre 1 byte y ' . (int) env('UPLOAD_MAX_MB', 5) . ' MB', 413);
        if (!is_uploaded_file($file['tmp_name'])) Response::error('Archivo inválido', 400);

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime  = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);
        if (!isset(self::TYPES[$mime])) Response::error('Solo se permiten PDF, JPG, PNG o WebP', 415);

        $head = (string) file_get_contents($file['tmp_name'], false, null, 0, 8);
        if ($mime === 'application/pdf' && !str_starts_with($head, '%PDF-')) Response::error('PDF inválido', 415);
        if ($mime !== 'application/pdf' && @getimagesize($file['tmp_name']) === false) Response::error('Imagen inválida', 415);

        $sub = date('Y/m');
        $key = $sub . '/' . bin2hex(random_bytes(16)) . '.' . self::TYPES[$mime];
        $dir = self::root() . '/' . $sub;
        if (!is_dir($dir) && !mkdir($dir, 0750, true) && !is_dir($dir)) Response::error('No se pudo guardar el archivo', 500);
        if (!move_uploaded_file($file['tmp_name'], self::root() . '/' . $key)) Response::error('No se pudo guardar el archivo', 500);
        @chmod(self::root() . '/' . $key, 0640);

        return $key;
    }

    public static function delete(string $key): void
    {
        if (preg_match(self::KEY_RE, $key)) @unlink(self::root() . '/' . $key);
    }

    /** Envía el archivo al cliente. La autorización la decide el controlador ANTES de llamar. */
    public static function stream(string $key): never
    {
        if (!preg_match(self::KEY_RE, $key)) Response::notFound('Archivo no encontrado');
        $path = self::root() . '/' . $key;
        if (!is_file($path)) Response::notFound('Archivo no encontrado');

        $ext  = pathinfo($key, PATHINFO_EXTENSION);
        $mime = array_search($ext, self::TYPES, true);
        header('Content-Type: ' . $mime);
        header('Content-Length: ' . filesize($path));
        header('Content-Disposition: attachment; filename="comprobante.' . $ext . '"');
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: private, no-store');
        readfile($path);
        exit;
    }
}
