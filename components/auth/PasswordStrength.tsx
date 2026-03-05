
import { Check, X } from "lucide-react";

interface PasswordStrengthProps {
    password?: string;
}

export function PasswordStrength({ password = "" }: PasswordStrengthProps) {
    const validations = [
        {
            label: "Pelo menos 8 caracteres",
            pass: password.length >= 8,
        },
        {
            label: "Letra maiúscula",
            pass: /[A-Z]/.test(password),
        },
        {
            label: "Letra minúscula",
            pass: /[a-z]/.test(password),
        },
        {
            label: "Número",
            pass: /[0-9]/.test(password),
        },
        {
            label: "Caractere especial (@$!%*?&)",
            pass: /[^A-Za-z0-9]/.test(password),
        },
    ];

    return (
        <div className="space-y-2 mt-2">
            {validations.map((v, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                    {v.pass ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                    ) : (
                        <X className="w-3 h-3 text-gray-500" />
                    )}
                    <span className={v.pass ? "text-emerald-500" : "text-gray-500"}>
                        {v.label}
                    </span>
                </div>
            ))}
        </div>
    );
}
