
# Campus Connect – Campus Event & Venue Management System

## Overview

Campus Connect is a web-based application developed to simplify campus event coordination and venue booking at NMAM Institute of Technology (NMAMIT). It provides a centralized platform for college users to access event-related services and manage auditorium and venue booking requests.

## Key Features

- **User Authentication:** Registration and login functionality.
- **Email Verification:** OTP-based verification of college email addresses.
- **Venue Booking:** Submit and manage auditorium and venue booking requests.
- **Event Coordination:** Organize campus event and venue information.
- **Data Management:** Maintain application records using Excel-based storage.
- **User-Friendly Interface:** Simple and accessible web interface.

## Technology Stack

- **Frontend:** React.js, Vite
- **Backend:** Node.js, Express.js
- **Authentication:** JSON Web Token (JWT)
- **Email Service:** OTP-based email delivery
- **Storage:** Microsoft Excel
- **Tools:** Git, GitHub, Visual Studio Code
- **Deployment Platform:** Render

## Project Structure

```text
CampusConnect/
├── frontend/
│   ├── public/
│   ├── src/
│   └── package.json
├── backend/
│   ├── src/
│   ├── data/
│   └── package.json
└── README.md
```

## Installation and Setup

### Prerequisites

- Node.js and npm
- Git
- Visual Studio Code

### Step 1: Clone the Repository

```bash
git clone https://github.com/thrisharshetty2005/CampusConnect-A-Event-Management-System-.git
cd CampusConnect-A-Event-Management-System-
```

### Step 2: Set Up the Frontend

```bash
cd frontend
npm install
npm run dev
```

### Step 3: Set Up the Backend

Open a separate terminal:

```bash
cd backend
npm install
npm start
```

Configure the necessary environment variables before starting the backend.

## Security and Configuration

- Store sensitive credentials in environment variables.
- Keep API keys and passwords out of version control.
- Configure email delivery credentials for OTP verification.
- Ensure application data is backed up appropriately.

## Project Goal

The goal of Campus Connect is to improve campus event management by providing a convenient, centralized system for venue booking, user verification, and event coordination.

## Author

**Thrisha R Shetty**

GitHub: [thrisharshetty2005](https://github.com/thrisharshetty2005)

---

Developed as a campus event and venue management project.
