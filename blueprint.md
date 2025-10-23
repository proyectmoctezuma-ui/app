# Moctezuma Juegos - Blueprint

## Overview

This document outlines the architecture and implementation of the Moctezuma Juegos admin application. The application is built using Next.js and Firebase, providing a secure and scalable platform for managing game content.

## Implemented Features

### Authentication

*   **Firebase Authentication:** The application uses Firebase Authentication with Google Sign-In to provide a secure and easy-to-use login system.
*   **Session Management:** The application uses HTTP-only session cookies for secure session management, protecting against XSS attacks.
*   **Server-Side Rendering (SSR) with Authentication:** The application uses a combination of client-side and server-side rendering to provide a seamless user experience while maintaining security.
*   **Protected Routes:** The `/pages/admin` route is protected, ensuring that only authenticated administrators can access the dashboard.

### Admin Dashboard

*   **Real-time Data Display:** The admin dashboard displays real-time data from the Firebase Realtime Database.
*   **Data Writing:** Administrators can write data to the Realtime Database directly from the dashboard.

## Plan and Next Steps

To complete the setup and run the application, you will need to configure the necessary environment variables. These variables are essential for connecting to your Firebase project and securing the application.

### Environment Variable Configuration

You will need to create a `.env.local` file in the root of your project and add the following environment variables:

```
FIREBASE_SERVICE_ACCOUNT_KEY=your-firebase-service-account-key-json
NEXT_PUBLIC_FIREBASE_DATABASE_URL=your-firebase-database-url
```

*   `FIREBASE_SERVICE_ACCOUNT_KEY`: This is the JSON service account key for your Firebase project. You can obtain this from the Firebase console under **Project settings > Service accounts**.
*   `NEXT_PUBLIC_FIREBASE_DATABASE_URL`: This is the URL of your Firebase Realtime Database. You can find this in the Firebase console under **Realtime Database**.

Once you have created the `.env.local` file and added the required environment variables, the application should run without the "Internal Server Error." If you continue to experience issues, please let me know.
