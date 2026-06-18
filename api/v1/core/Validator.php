<?php
declare(strict_types=1);

class Validator
{
    private array $errors = [];
    private array $data   = [];

    public function __construct(private array $input) {}

    public static function make(array $input, array $rules): self
    {
        $v = new self($input);
        foreach ($rules as $field => $ruleStr) {
            $v->apply($field, explode('|', $ruleStr));
        }
        return $v;
    }

    private function apply(string $field, array $rules): void
    {
        $value = $this->input[$field] ?? null;

        foreach ($rules as $rule) {
            [$ruleName, $param] = array_pad(explode(':', $rule, 2), 2, null);

            if ($ruleName === 'required') {
                if ($value === null || $value === '') {
                    $this->errors[$field][] = "$field es requerido";
                    return;
                }
            }

            if ($value === null || $value === '') continue;

            match ($ruleName) {
                'email'   => filter_var($value, FILTER_VALIDATE_EMAIL)
                                ? null
                                : $this->errors[$field][] = "$field debe ser un email válido",

                'min'     => strlen((string) $value) >= (int) $param
                                ? null
                                : $this->errors[$field][] = "$field debe tener al menos $param caracteres",

                'max'     => strlen((string) $value) <= (int) $param
                                ? null
                                : $this->errors[$field][] = "$field no puede superar $param caracteres",

                'numeric' => is_numeric($value)
                                ? null
                                : $this->errors[$field][] = "$field debe ser numérico",

                'in'      => in_array($value, explode(',', $param))
                                ? null
                                : $this->errors[$field][] = "$field tiene un valor no permitido",

                default   => null,
            };
        }

        if (!isset($this->errors[$field]) && $value !== null) {
            $this->data[$field] = is_string($value) ? trim(strip_tags($value)) : $value;
        }
    }

    public function fails(): bool   { return !empty($this->errors); }
    public function errors(): array { return $this->errors; }
    public function validated(): array { return $this->data; }

    public function get(string $field, mixed $default = null): mixed
    {
        return $this->data[$field] ?? $default;
    }
}
