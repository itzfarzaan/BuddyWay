/**
 * Utility functions for BuddyWay
 */

/**
 * Generate a unique session code
 * @returns {string} Session code
 */
function generateSessionCode() {
  return Math.random().toString(36).substr(2, 9);
}

module.exports = {
  generateSessionCode
};
