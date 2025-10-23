# Moctezuma Juegos - Blueprint

## Overview

This document outlines the architecture and implementation of the Moctezuma Juegos admin application. The application is built using Next.js and Firebase, providing a secure and scalable platform for managing game content.

## Implemented Features

### Authentication

*   **Firebase Authentication:** The application uses Firebase Authentication with Google Sign-In and email/password to provide secure and flexible login options.
*   **Session Management:** The application uses HTTP-only session cookies for secure session management, protecting against XSS attacks.
*   **Server-Side Rendering (SSR) with Authentication:** The application uses a combination of client-side and server-side rendering to provide a seamless user experience while maintaining security.
*   **Protected Routes:** The `/admin` route is protected, ensuring that only authenticated administrators can access the dashboard.
*   **Custom Login and Registration Pages:** The application features custom-designed login (`/login`) and registration (`/register`) pages with a consistent, modern look and feel.

### Password Recovery

*   **Employee Code Verification:** A password recovery flow is implemented at `/forgot-password`, allowing users to reset their password without needing email access.
*   **Two-Step Recovery Process:**
    1.  **Verify Identity:** Users first enter their unique employee code to confirm their identity.
    2.  **Reset Password:** After successful verification, they can set a new password directly on the same page.
*   **Secure Server-Side Logic:** Two Server Actions are used to handle the process securely:
    *   One action verifies the employee code against the Firebase Realtime Database.
    *   A second action updates the user's password in Firebase Authentication using the Firebase Admin SDK.

### User Profile Completion

*   **Post-Registration Profile Form:** After a new user successfully registers, they are automatically redirected to a `/complete-profile` page.
*   **Data Collection:** This page contains a form that prompts the user to enter their employee code and full name.
*   **Server Action for Data Persistence:** A Next.js Server Action is used to securely process the form data on the server.
*   **Firebase Realtime Database Integration:** The submitted profile information (employee code, name, and email) is saved to the Firebase Realtime Database under the `users` node, using the user's unique Firebase UID as the key (`/users/{uid}`).
*   **Redirection:** Upon successful profile submission, the user is redirected to the `/admin` dashboard.

### Admin Dashboard

*   **Real-time Data Display:** The admin dashboard is prepared to display real-time data from the Firebase Realtime Database.
*   **Data Writing:** Administrators have the capability to write data to the Realtime Database directly from the dashboard.
*   **Dynamic, Personalized Content:** The dashboard is designed to be dynamic, displaying content and features that are specific to each logged-in employee.
*   **Gamification Features:**
    *   **Game Library:** A library of six interactive games is available to employees.
    *   **Weekly Game Unlocking:** A new game is automatically unlocked each week, based on the employee's registration date, to encourage sustained engagement.
    *   **Score Tracking:** A dedicated section allows employees to view their scores for each game.

## Plan and Next Steps

The core authentication, profile creation, password recovery, and the foundational elements of the gamified dashboard are now complete. The next steps will focus on refining the gameplay mechanics, expanding the game library, and adding more detailed analytics for both employees and administrators.
