<?php
declare(strict_types=1);

/**
 * Validador del servidor. Reglas: required, email, min:n, max:n (caracteres; para contraseñas
 * `bytes_max:n`), numeric, int, between:a,b, in:a,b,c, date, url, regex:/…/, alpha_code.
 * Todas rechazan tipos no escalares (arrays/objetos) en lugar de lanzar errores de tipo.
 */
class Validator
{
    /** Campos que NO se limpian ni se recortan: alterarlos cambiaría la contraseña/token real. */
    private const RAW_FIELDS = ['password', 'current_password', 'new_password', 'token', 'refresh_token'];

    private array $errors = [];
    private array $data   = [];

    public function __construct(private array $input) {}

    public static function make(array $input, array $rules): self
    {
        $v = new self($input);
        foreach ($rules as $field => $ruleStr) {
            $v->apply($field, $ruleStr === '' ? [] : explode('|', $ruleStr));
        }
        return $v;
    }

    private function fail(string $field, string $msg): void { $this->errors[$field][] = $msg; }

    private function apply(string $field, array $rules): void
    {
        $value = $this->input[$field] ?? null;

        if (in_array('required', $rules, true) && ($value === null || $value === '')) {
            $this->fail($field, "$field es requerido");
            return;
        }
        if ($value === null || $value === '') return;

        if (!is_scalar($value)) {                       // arrays/objetos nunca son válidos
            $this->fail($field, "$field tiene un formato inválido");
            return;
        }

        foreach ($rules as $rule) {
            [$name, $param] = array_pad(explode(':', $rule, 2), 2, null);
            $str = (string) $value;

            switch ($name) {
                case 'email':
                    if (!filter_var($str, FILTER_VALIDATE_EMAIL)) $this->fail($field, "$field debe ser un email válido");
                    break;
                case 'min':
                    if (mb_strlen($str) < (int) $param) $this->fail($field, "$field debe tener al menos $param caracteres");
                    break;
                case 'max':
                    if (mb_strlen($str) > (int) $param) $this->fail($field, "$field no puede superar $param caracteres");
                    break;
                case 'bytes_max':      // bcrypt ignora todo después de 72 bytes
                    if (strlen($str) > (int) $param) $this->fail($field, "$field no puede superar $param bytes");
                    break;
                case 'numeric':
                    if (!is_numeric($str) || !is_finite((float) $str)) $this->fail($field, "$field debe ser numérico");
                    break;
                case 'int':
                    if (filter_var($str, FILTER_VALIDATE_INT) === false) $this->fail($field, "$field debe ser un entero");
                    break;
                case 'between':
                    [$lo, $hi] = array_map('floatval', explode(',', (string) $param));
                    if (!is_numeric($str) || (float) $str < $lo || (float) $str > $hi) $this->fail($field, "$field debe estar entre $lo y $hi");
                    break;
                case 'in':
                    if (!in_array($str, explode(',', (string) $param), true)) $this->fail($field, "$field tiene un valor no permitido");
                    break;
                case 'date':
                    $d = DateTime::createFromFormat('Y-m-d', $str);
                    if (!$d || $d->format('Y-m-d') !== $str) $this->fail($field, "$field debe ser una fecha AAAA-MM-DD");
                    break;
                case 'url':
                    if (!filter_var($str, FILTER_VALIDATE_URL) || !preg_match('#^https?://#i', $str)) $this->fail($field, "$field debe ser una URL http(s)");
                    break;
                case 'regex':
                    if (!preg_match((string) $param, $str)) $this->fail($field, "$field tiene un formato inválido");
                    break;
            }
        }

        if (!isset($this->errors[$field])) {
            $this->data[$field] = is_string($value) && !in_array($field, self::RAW_FIELDS, true)
                ? trim(strip_tags($value))
                : $value;
        }
    }

    public function fails(): bool      { return !empty($this->errors); }
    public function errors(): array    { return $this->errors; }
    public function validated(): array { return $this->data; }

    public function get(string $field, mixed $default = null): mixed
    {
        return $this->data[$field] ?? $default;
    }
}
