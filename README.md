# Braddock Website (Full Stack)

A full-stack web application for designers to showcase portfolios and interact with viewers. Built with:

- React (frontend)  
- Node.js + Express (backend)  
- PostgreSQL (database)  
- AWS S3 (image storage)  

---

## Features

- Designer and Viewer roles with different UI experiences  
- Designers can upload and manage portfolio images (stored in S3)  
- Viewers can browse and leave comments on images  
- User authentication and role-based access control  
- Clean React frontend and Express REST API backend  

---

## Project Structure
braddock-website-fullstack/
├── client/ # React frontend
│ └── src/App.js # Main frontend logic
├── server/ # Express backend
│ ├── index.js # API entry point
│ └── database/
│ └── init_db.sql # PostgreSQL schema
├── .env # Environment variables (not committed)
└── README.md

### Important

This repository does **not** include AWS credentials or `.env` files.  
To run the project locally, create your own `.env` file with your AWS keys and database credentials as described above.
