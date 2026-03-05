'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { signIn, signOut, auth } from '@/auth';
import { AuthError } from 'next-auth';

const PasswordSchema = z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

const RegisterSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email'),
    password: PasswordSchema,
});

const LoginSchema = z.object({
    email: z.string().email('Invalid email'),
    password: z.string().min(1, 'Password is required'),
});

export async function register(formData: z.infer<typeof RegisterSchema>) {
    const validatedFields = RegisterSchema.safeParse(formData);

    if (!validatedFields.success) {
        // Return first error message
        return { error: validatedFields.error.issues[0].message };
    }

    const { email, password, name } = validatedFields.data;
    const hashedPassword = await bcrypt.hash(password, 10);

    const existingUser = await db.user.findUnique({
        where: { email },
    });

    if (existingUser) {
        return { error: "Email already in use!" };
    }

    await db.user.create({
        data: {
            name,
            email,
            password: hashedPassword,
        },
    });

    // Auto-login after registration
    await signIn("credentials", {
        email,
        password,
        redirectTo: "/",
    });

    return { success: "User created!" };
}

export async function login(formData: z.infer<typeof LoginSchema>) {
    const validatedFields = LoginSchema.safeParse(formData);

    if (!validatedFields.success) {
        return { error: "Invalid fields!" };
    }

    const { email, password } = validatedFields.data;

    try {
        await signIn("credentials", {
            email,
            password,
            redirectTo: "/",
        });
    } catch (error) {
        // --- DEBUG: LOG DE ERRO NO CONSOLE (VERCEL) ---
        console.error("❌ ERRO NO LOGIN (SERVER ACTION):", error);
        // ---------------------------------------------

        if (error instanceof AuthError) {
            switch (error.type) {
                case "CredentialsSignin":
                    return { error: "Invalid credentials!" };
                default:
                    return { error: "Something went wrong!" };
            }
        }
        throw error;
    }
}

export async function logout() {
    await signOut({ redirectTo: "/login" });
}

const UpdateProfileSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email"),
    password: PasswordSchema.optional(),
});

export async function updateProfile(formData: z.infer<typeof UpdateProfileSchema>) {
    const session = await auth();
    if (!session?.user?.id) {
        return { error: "Unauthorized" };
    }

    const validatedFields = UpdateProfileSchema.safeParse(formData);
    if (!validatedFields.success) {
        return { error: "Invalid fields!" };
    }

    const { name, email, password } = validatedFields.data;
    const userId = session.user.id;

    // Check if email is taken by ANOTHER user
    const existingUser = await db.user.findFirst({
        where: {
            email: email,
            NOT: {
                id: userId
            }
        }
    });

    if (existingUser) {
        return { error: "Email already in use by another account!" };
    }

    const updateData: any = {
        name,
        email,
    };

    if (password && password.trim().length > 0) {
        // Validate Strong Password manually since it's optional in schema but mandatory if provided
        const passwordValidation = PasswordSchema.safeParse(password);
        if (!passwordValidation.success) {
            return { error: passwordValidation.error.issues[0].message };
        }

        updateData.password = await bcrypt.hash(password, 10);
    }

    try {
        await db.user.update({
            where: { id: userId },
            data: updateData,
        });

        // Revalidate to update UI name/email
        // revalidatePath('/', 'layout'); // Optional: force refresh
        return { success: "Profile updated successfully!" };
    } catch (error) {
        console.error("Profile Update Error:", error);
        return { error: "Failed to update profile." };
    }
}
