<?php
declare(strict_types=1);

class Router
{
    private array $routes     = [];
    private array $middleware = [];

    public function get(string $path, array $handler, array $mw = []): void
    {
        $this->add('GET', $path, $handler, $mw);
    }

    public function post(string $path, array $handler, array $mw = []): void
    {
        $this->add('POST', $path, $handler, $mw);
    }

    public function put(string $path, array $handler, array $mw = []): void
    {
        $this->add('PUT', $path, $handler, $mw);
    }

    public function delete(string $path, array $handler, array $mw = []): void
    {
        $this->add('DELETE', $path, $handler, $mw);
    }

    private function add(string $method, string $path, array $handler, array $mw): void
    {
        $this->routes[] = ['method' => $method, 'path' => $path, 'handler' => $handler, 'mw' => $mw];
    }

    public function dispatch(): void
    {
        $method = $_SERVER['REQUEST_METHOD'];
        $uri    = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

        // Strip /api/v1 prefix if present
        $base = '/api/v1';
        if (str_starts_with($uri, $base)) {
            $uri = substr($uri, strlen($base));
        }
        $uri = '/' . trim($uri, '/');

        if ($method === 'OPTIONS') {
            http_response_code(204);
            exit;
        }

        foreach ($this->routes as $route) {
            if ($route['method'] !== $method) continue;

            $pattern = preg_replace('/\{([a-zA-Z_]+)\}/', '([^/]+)', $route['path']);
            if (!preg_match('#^' . $pattern . '$#', $uri, $matches)) continue;

            array_shift($matches);

            // Run middleware chain
            foreach ($route['mw'] as $mwClass) {
                (new $mwClass())->handle();
            }

            [$class, $action] = $route['handler'];
            (new $class())->$action(...$matches);
            return;
        }

        Response::notFound('Endpoint not found');
    }
}
