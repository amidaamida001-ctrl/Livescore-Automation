/**
 * Placeholder source file for score comparison logic.
 * This script is intended to be used in a Code node after validation.
 */

function hasScoreChanged(previous, current) {
  if (!previous || !current) {
    return false;
  }

  return (
    previous.homeScore !== current.homeScore ||
    previous.awayScore !== current.awayScore
  );
}

module.exports = {
  hasScoreChanged,
};
