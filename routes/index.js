const express = require('express');
const router = express.Router();

/**
 * Set up Express routes
 * @param {Object} app - Express app instance
 */
function setupRoutes(app) {
  // Home page (landing page)
  app.get("/", (req, res) => {
    res.render("home");
  });

  // Map page (requires session)
  app.get("/map", (req, res) => {
    res.render("index");
  });

  return router;
}

module.exports = setupRoutes;
