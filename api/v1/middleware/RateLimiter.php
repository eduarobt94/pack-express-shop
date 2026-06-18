<?php
declare(strict_types=1);

class RateLimiter
{
    public function handle(): void
    {
        $ip      = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $limit   = (int) env('RATE_LIMIT_REQUESTS', 60);
        $window  = (int) env('RATE_LIMIT_WINDOW', 60);
        $key     = md5($ip . '_' . floor(time() / $window));
        $file    = sys_get_temp_dir() . '/pkx_rl_' . $key;

        $hits = file_exists($file) ? (int) file_get_contents($file) : 0;

        if ($hits >= $limit) {
            header('Retry-After: ' . $window);
            Response::error('Demasiadas solicitudes. Intenta nuevamente en breve.', 429);
        }

        file_put_contents($file, $hits + 1, LOCK_EX);
    }
}
