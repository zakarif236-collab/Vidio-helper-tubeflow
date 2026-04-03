// Section validation middleware for Express
// Enforces SCRIPT/TEXT section rules before processing

function isCode(text) {
  // Simple heuristic for code/script detection
  const codePatterns = [/^\s*(def |import |from |function |let |const |var |class |#include |public |private |if |for |while |return )/m];
  return codePatterns.some((p) => p.test(text));
}

function validateSections(req, res, next) {
  const { scriptSection, textSection } = req.body;
  if (scriptSection && scriptSection.trim() && !isCode(scriptSection)) {
    return res.status(400).json({ error: "Text is not required in the SCRIPT section. Please move your text to the TEXT section or rewrite it as valid script." });
  }
  if (textSection && textSection.trim() && isCode(textSection)) {
    return res.status(400).json({ error: "Script is not required in the TEXT section. Please move your script to the SCRIPT section or rewrite it as descriptive text." });
  }
  next();
}

export default validateSections;
