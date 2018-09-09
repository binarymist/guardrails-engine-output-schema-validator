const Joi = require("joi");
const program = require("commander");
const fs = require("fs");

const pkg = require("./package.json");

/* arguments parsing */
program
  .version(pkg.version)
  .option("-f, --file [filePath]", "Read from file")
  .option("-s, --stdin", "Read from stdin")
  .parse(process.argv);

/* schemas */
const processSchema = Joi.object().keys({
  name: Joi.string().required(),
  version: Joi.string().required()
});

const lineitemSchema = Joi.object().keys({
  type: Joi.string().required(),
  ruleId: Joi.string().required(),
  location: Joi.object().keys({
    path: Joi.string()
      .regex(/^(?!\/opt\/mount\/|.\/|\/).*/)
      .required(),
    positions: Joi.object().keys({
      begin: Joi.object()
        .keys({
          line: Joi.number(),
          column: Joi.number().optional()
        })
        .required(),
      end: Joi.object()
        .keys({
          line: Joi.number(),
          column: Joi.number().optional()
        })
        .optional()
    })
  }),
  metadata: Joi.object().required()
});

const envelopeSchema = Joi.object().keys({
  engine: Joi.object()
    .keys({
      name: Joi.string().required(),
      version: Joi.string().required()
    })
    .required(),
  language: Joi.string()
    .valid("javascript", "python", "ruby", "go", "solidity", "general")
    .required(),
  status: Joi.string()
    .valid("success", "failure")
    .required(),
  executionTime: Joi.number().required(),
  issues: Joi.number().required(),
  errors: [Joi.array(), null],
  output: Joi.array().required(),
  rawOutput: [Joi.string().required(), Joi.object().required()],
  process: processSchema
});

/* data loading */

function readFromStdin() {
  return readFromFile("/dev/stdin");
}

function readFromFile(filePath) {
  try {
    let data = fs.readFileSync(filePath).toString();
    return JSON.parse(data);
  } catch (err) {
    console.log(err.message);
    process.exit(1);
  }
}
let reportData;

if (program.stdin) {
  reportData = readFromStdin();
} else if (program.file) {
  reportData = readFromFile(program.file);
}

if (!reportData) {
  console.log("No data was supplied to validate. Run `-h` for help.");
  process.exit(1);
}

/* validating the envelope structure */
Joi.validate(reportData, envelopeSchema, (err, value) => {
  if (err) {
    console.log(err);
  } else {
    console.log("envelope  ✅");
  }
});

/* validating the line items */
reportData.output.forEach(lineItem => {
  let schema = lineitemSchema;
  Joi.validate(lineItem, schema, (err, value) => {
    if (err) {
      console.log(err);
    } else {
      console.log(lineItem.type + "  ✅");
    }
  });
});
