import React from "react";
import { expect } from "chai";
import sinon from "sinon";
import { Simulate } from "react-addons-test-utils";

import validateFormData, {
  toErrorList,
  filterEmptyValues,
} from "../src/validate";
import { createFormComponent } from "./test_utils";

describe("Validation", () => {
  describe("validate.validateFormData()", () => {
    describe("No custom validate function", () => {
      const illFormedKey = "bar.'\"[]()=+*&^%$#@!";
      const schema = {
        type: "object",
        properties: {
          foo: { type: "string" },
          [illFormedKey]: { type: "string" },
        },
      };

      let errors, errorSchema;

      beforeEach(() => {
        const result = validateFormData(
          { foo: 42, [illFormedKey]: 41 },
          schema
        );
        errors = result.errors;
        errorSchema = result.errorSchema;
      });

      it("should return an error list", () => {
        expect(errors).to.have.length.of(2);
        expect(errors[0].message).eql("is not of a type(s) string");
        expect(errors[1].message).eql("is not of a type(s) string");
      });

      it("should return an errorSchema", () => {
        expect(errorSchema.foo.__errors).to.have.length.of(1);
        expect(errorSchema.foo.__errors[0]).eql("is not of a type(s) string");
        expect(errorSchema[illFormedKey].__errors).to.have.length.of(1);
        expect(errorSchema[illFormedKey].__errors[0]).eql(
          "is not of a type(s) string"
        );
      });
    });

    describe("Custom validate function", () => {
      let errors, errorSchema;

      const schema = {
        type: "object",
        required: ["pass1", "pass2"],
        properties: {
          pass1: { type: "string" },
          pass2: { type: "string" },
        },
      };

      beforeEach(() => {
        const validate = (formData, errors) => {
          if (formData.pass1 !== formData.pass2) {
            errors.pass2.addError("passwords don't match.");
          }
          return errors;
        };
        const formData = { pass1: "a", pass2: "b" };
        const result = validateFormData(formData, schema, validate);
        errors = result.errors;
        errorSchema = result.errorSchema;
      });

      it("should return an error list", () => {
        expect(errors).to.have.length.of(1);
        expect(errors[0].stack).eql("pass2: passwords don't match.");
      });

      it("should return an errorSchema", () => {
        expect(errorSchema.pass2.__errors).to.have.length.of(1);
        expect(errorSchema.pass2.__errors[0]).eql("passwords don't match.");
      });
    });

    describe("toErrorList()", () => {
      it("should convert an errorSchema into a flat list", () => {
        expect(
          toErrorList({
            __errors: ["err1", "err2"],
            a: {
              b: {
                __errors: ["err3", "err4"],
              },
            },
            c: {
              __errors: ["err5"],
            },
          })
        ).eql([
          { stack: "root: err1" },
          { stack: "root: err2" },
          { stack: "b: err3" },
          { stack: "b: err4" },
          { stack: "c: err5" },
        ]);
      });
    });

    describe("transformErrors", () => {
      const illFormedKey = "bar.'\"[]()=+*&^%$#@!";
      const schema = {
        type: "object",
        properties: {
          foo: { type: "string" },
          [illFormedKey]: { type: "string" },
        },
      };
      const newErrorMessage = "Better error message";
      const transformErrors = errors => {
        return [Object.assign({}, errors[0], { message: newErrorMessage })];
      };

      let errors;

      beforeEach(() => {
        const result = validateFormData(
          { foo: 42, [illFormedKey]: 41 },
          schema,
          undefined,
          transformErrors
        );
        errors = result.errors;
      });

      it("should use transformErrors function", () => {
        expect(errors).not.to.be.empty;
        expect(errors[0].message).to.equal(newErrorMessage);
      });
    });
  });

  describe("Form integration", () => {
    let sandbox;

    beforeEach(() => {
      sandbox = sinon.sandbox.create();
    });

    afterEach(() => {
      sandbox.restore();
    });

    describe("JSONSchema validation", () => {
      describe("Required fields", () => {
        const schema = {
          type: "object",
          required: ["foo"],
          properties: {
            foo: { type: "string" },
            bar: { type: "string" },
          },
        };

        var comp, node, onError;

        beforeEach(() => {
          onError = sandbox.spy();
          const compInfo = createFormComponent({
            schema,
            formData: {
              foo: undefined,
            },
            onError,
          });
          comp = compInfo.comp;
          node = compInfo.node;

          Simulate.submit(node);
        });

        it("should validate a required field", () => {
          expect(comp.state.errors).to.have.length.of(1);
          expect(comp.state.errors[0].message).eql('requires property "foo"');
        });

        it("should render errors", () => {
          expect(node.querySelectorAll(".errors li")).to.have.length.of(1);
          expect(node.querySelector(".errors li").textContent).eql(
            'instance requires property "foo"'
          );
        });

        it("should trigger the onError handler", () => {
          sinon.assert.calledWith(
            onError,
            sinon.match(errors => {
              return errors[0].message === 'requires property "foo"';
            })
          );
        });
      });

      describe("Min length", () => {
        const schema = {
          type: "object",
          required: ["foo"],
          properties: {
            foo: {
              type: "string",
              minLength: 10,
            },
          },
        };

        var comp, node, onError;

        beforeEach(() => {
          onError = sandbox.spy();
          const compInfo = createFormComponent({
            schema,
            formData: {
              foo: "123456789",
            },
            onError,
          });
          comp = compInfo.comp;
          node = compInfo.node;

          Simulate.submit(node);
        });

        it("should validate a minLength field", () => {
          expect(comp.state.errors).to.have.length.of(1);
          expect(comp.state.errors[0].message).eql(
            "does not meet minimum length of 10"
          );
        });

        it("should render errors", () => {
          expect(node.querySelectorAll(".errors li")).to.have.length.of(1);
          expect(node.querySelector(".errors li").textContent).eql(
            "instance.foo does not meet minimum length of 10"
          );
        });

        it("should trigger the onError handler", () => {
          sinon.assert.calledWith(
            onError,
            sinon.match(errors => {
              return errors[0].message === "does not meet minimum length of 10";
            })
          );
        });
      });
    });

    describe("Custom Form validation", () => {
      it("should validate a simple string value", () => {
        const schema = { type: "string" };
        const formData = "a";

        function validate(formData, errors) {
          if (formData !== "hello") {
            errors.addError("Invalid");
          }
          return errors;
        }

        const { comp } = createFormComponent({
          schema,
          validate,
          liveValidate: true,
        });
        comp.componentWillReceiveProps({ formData });

        expect(comp.state.errorSchema).eql({
          __errors: ["Invalid"],
        });
      });

      it("should submit form on valid data", () => {
        const schema = { type: "string" };
        const formData = "hello";
        const onSubmit = sandbox.spy();

        function validate(formData, errors) {
          if (formData !== "hello") {
            errors.addError("Invalid");
          }
          return errors;
        }

        const { node } = createFormComponent({
          schema,
          formData,
          validate,
          onSubmit,
        });

        Simulate.submit(node);

        sinon.assert.called(onSubmit);
      });

      it("should prevent form submission on invalid data", () => {
        const schema = { type: "string" };
        const formData = "a";
        const onSubmit = sandbox.spy();
        const onError = sandbox.spy();

        function validate(formData, errors) {
          if (formData !== "hello") {
            errors.addError("Invalid");
          }
          return errors;
        }

        const { node } = createFormComponent({
          schema,
          formData,
          validate,
          onSubmit,
          onError,
        });

        Simulate.submit(node);

        sinon.assert.notCalled(onSubmit);
        sinon.assert.called(onError);
      });

      it("should validate a simple object", () => {
        const schema = {
          type: "object",
          properties: {
            pass1: { type: "string", minLength: 3 },
            pass2: { type: "string", minLength: 3 },
          },
        };

        const formData = { pass1: "aaa", pass2: "b" };

        function validate(formData, errors) {
          const { pass1, pass2 } = formData;
          if (pass1 !== pass2) {
            errors.pass2.addError("Passwords don't match");
          }
          return errors;
        }

        const { comp } = createFormComponent({
          schema,
          validate,
          liveValidate: true,
        });
        comp.componentWillReceiveProps({ formData });

        expect(comp.state.errorSchema).eql({
          __errors: [],
          pass1: {
            __errors: [],
          },
          pass2: {
            __errors: [
              "does not meet minimum length of 3",
              "Passwords don't match",
            ],
          },
        });
      });

      it("should validate an array of object", () => {
        const schema = {
          type: "array",
          items: {
            type: "object",
            properties: {
              pass1: { type: "string" },
              pass2: { type: "string" },
            },
          },
        };

        const formData = [
          { pass1: "a", pass2: "b" },
          { pass1: "a", pass2: "a" },
        ];

        function validate(formData, errors) {
          formData.forEach(({ pass1, pass2 }, i) => {
            if (pass1 !== pass2) {
              errors[i].pass2.addError("Passwords don't match");
            }
          });
          return errors;
        }

        const { comp } = createFormComponent({
          schema,
          validate,
          liveValidate: true,
        });
        comp.componentWillReceiveProps({ formData });

        expect(comp.state.errorSchema).eql({
          0: {
            pass1: {
              __errors: [],
            },
            pass2: {
              __errors: ["Passwords don't match"],
            },
            __errors: [],
          },
          1: {
            pass1: {
              __errors: [],
            },
            pass2: {
              __errors: [],
            },
            __errors: [],
          },
          __errors: [],
        });
      });

      it("should validate a simple array", () => {
        const schema = {
          type: "array",
          items: {
            type: "string",
          },
        };

        const formData = ["aaa", "bbb", "ccc"];

        function validate(formData, errors) {
          if (formData.indexOf("bbb") !== -1) {
            errors.addError("Forbidden value: bbb");
          }
          return errors;
        }

        const { comp } = createFormComponent({
          schema,
          validate,
          liveValidate: true,
        });
        comp.componentWillReceiveProps({ formData });

        expect(comp.state.errorSchema).eql({
          0: { __errors: [] },
          1: { __errors: [] },
          2: { __errors: [] },
          __errors: ["Forbidden value: bbb"],
        });
      });
    });

    describe("showErrorList prop validation", () => {
      describe("Required fields", () => {
        const schema = {
          type: "object",
          required: ["foo"],
          properties: {
            foo: { type: "string" },
            bar: { type: "string" },
          },
        };

        var comp, node, onError;

        beforeEach(() => {
          onError = sandbox.spy();
          const compInfo = createFormComponent({
            schema,
            formData: {
              foo: undefined,
            },
            onError,
            showErrorList: false,
          });
          comp = compInfo.comp;
          node = compInfo.node;

          Simulate.submit(node);
        });

        it("should validate a required field", () => {
          expect(comp.state.errors).to.have.length.of(1);
          expect(comp.state.errors[0].message).eql('requires property "foo"');
        });

        it("should not render error list if showErrorList prop true", () => {
          expect(node.querySelectorAll(".errors li")).to.have.length.of(0);
        });

        it("should trigger the onError handler", () => {
          sinon.assert.calledWith(
            onError,
            sinon.match(errors => {
              return errors[0].message === 'requires property "foo"';
            })
          );
        });
      });
    });

    describe("Custom ErrorList", () => {
      const schema = {
        type: "string",
        required: true,
        minLength: 1,
      };

      const uiSchema = {
        foo: "bar",
      };

      const formData = 0;

      const CustomErrorList = ({
        errors,
        errorSchema,
        schema,
        uiSchema,
        formContext: { className },
      }) => (
        <div>
          <div className="CustomErrorList">{errors.length} custom</div>
          <div className={"ErrorSchema"}>{errorSchema.__errors[0]}</div>
          <div className={"Schema"}>{schema.type}</div>
          <div className={"UiSchema"}>{uiSchema.foo}</div>
          <div className={className} />
        </div>
      );

      it("should use CustomErrorList", () => {
        const { node } = createFormComponent({
          schema,
          uiSchema,
          liveValidate: true,
          formData,
          ErrorList: CustomErrorList,
          formContext: { className: "foo" },
        });
        expect(node.querySelectorAll(".CustomErrorList")).to.have.length.of(1);
        expect(node.querySelector(".CustomErrorList").textContent).eql(
          "1 custom"
        );
        expect(node.querySelectorAll(".ErrorSchema")).to.have.length.of(1);
        expect(node.querySelector(".ErrorSchema").textContent).eql(
          "is required"
        );
        expect(node.querySelectorAll(".Schema")).to.have.length.of(1);
        expect(node.querySelector(".Schema").textContent).eql("string");
        expect(node.querySelectorAll(".UiSchema")).to.have.length.of(1);
        expect(node.querySelector(".UiSchema").textContent).eql("bar");
        expect(node.querySelectorAll(".foo")).to.have.length.of(1);
      });
    });
  });

  describe("filterEmptyValues()", () => {
    describe("Filter empty fields but not required empty fields", () => {
      const data = {
        isDelegateDetailsVerified: false,
        form: {
          schema: {
            required: [
              "title",
              "firstName",
              "secondName",
              "jobTitle",
              "emailAddress",
              "companyName",
              "companyData",
              "companyActivity",
              "companyType",
              "agencyNetwork",
              "holdingCompany",
              "address1",
              "city",
              "postcode",
              "directLine",
              "acceptTerms",
            ],
            properties: {
              title: {
                enumNames: [
                  "Mr",
                  "Mrs",
                  "Ms",
                  "Miss",
                  "Dr",
                  "Prof",
                  "Sir",
                  "Mx",
                ],
                type: "number",
                enum: [1, 2, 5, 3, 4, 6, 10, 14],
                title: "Title",
              },
              firstName: {
                maxLength: "100",
                type: "string",
                title: "First Name",
              },
              secondName: {
                maxLength: "100",
                type: "string",
                title: "Last Name",
              },
              jobTitle: {
                maxLength: "250",
                type: "string",
                title: "Job Title",
              },
              geographicalRegion: {
                required: ["geographicalRegion_sub"],
                properties: {
                  geographicalRegion_other: {
                    required: ["geographicalRegion_other_sub"],
                    properties: {
                      geographicalRegion_other_sub: {
                        maxlength: "250",
                        type: "string",
                        title: "Other",
                      },
                    },
                    type: "object",
                    title: "",
                  },
                  geographicalRegion_sub: {
                    enumNames: [
                      "Global",
                      "Africa",
                      "APAC",
                      "EMEA",
                      "Europe",
                      "Greater China",
                      "LATAM",
                      "MENA",
                      "Middle East",
                      "Other",
                    ],
                    type: "number",
                    enum: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                    title: "Geographical Remit",
                  },
                },
                type: "object",
                title: "",
              },
              emailAddress: {
                maxLength: "320",
                type: "string",
                title: "Email Address",
                format: "email",
              },
              companyName: {
                maxLength: "250",
                type: "string",
                title: "Company Name",
              },
              companyData: {
                title: "",
                type: "object",
                required: ["companyActivity"],
                properties: {
                  companyActivity: {
                    enumNames: [
                      "Advertiser/Client",
                      "Agency",
                      "Government/Not for Profit/Education",
                      "Media Owner",
                      "N/A",
                      "Production",
                    ],
                    type: "number",
                    enum: [3, 4, 6, 5, 8, 7],
                    title: "Company Activity",
                  },
                  activitySubsection: {
                    title: "",
                    type: "object",
                    properties: {
                      companyTypeAdvertiser: {
                        enumNames: [
                          "Associations",
                          "Automotive & Transport",
                          "Business to Business",
                          "Consultancy/Professional Services",
                          "Consumer Electronics",
                          "Entertainment",
                          "Environmental/Utility Company",
                          "Events Specialist",
                          "Financial",
                          "Food & Drink - Fast Moving Consumer Goods",
                          "Freelance / Individual",
                          "Government Sector",
                          "Health & Beauty - Fast Moving Consumer Goods",
                          "Healthcare",
                          "IT Services & Software",
                          "Other",
                          "Other Packaged Goods",
                          "Research, Data & Analytics",
                          "Retail",
                          "Search & Social Agency",
                          "Telecoms",
                        ],
                        type: "number",
                        enum: [
                          6,
                          7,
                          11,
                          13,
                          14,
                          22,
                          23,
                          24,
                          26,
                          27,
                          28,
                          31,
                          32,
                          33,
                          34,
                          38,
                          39,
                          45,
                          46,
                          47,
                          49,
                        ],
                        title: "Company Type",
                      },
                      companyTypeAgency: {
                        enumNames: [
                          "Brand Activation",
                          "Brand Agency",
                          "Branded Content",
                          "Consultancy/Professional Services",
                          "Creative Agency",
                          "Design Agency/Studio",
                          "Digital Agency",
                          "Direct Marketing Agency",
                          "Events Specialist",
                          "Freelance / Individual",
                          "Full Service Agency",
                          "Media Agency",
                          "Mobile Agency",
                          "PR Agency",
                          "Product Design",
                          "Research, Data & Analytics",
                          "Search & Social Agency",
                          "Specialist Healthcare Agency",
                        ],
                        type: "number",
                        enum: [
                          8,
                          9,
                          10,
                          13,
                          15,
                          16,
                          17,
                          19,
                          24,
                          28,
                          29,
                          35,
                          36,
                          42,
                          43,
                          45,
                          47,
                          48,
                        ],
                        title: "Company Type",
                      },
                      companyTypeGovernment: {
                        enumNames: [
                          "Associations",
                          "Charity/NGO",
                          "Education",
                          "Freelance / Individual",
                          "Government/Regulator",
                        ],
                        type: "number",
                        enum: [6, 12, 21, 28, 30],
                        title: "Company Type",
                      },
                      companyTypeMedia: {
                        enumNames: [
                          "Entertainment",
                          "Freelance / Individual",
                          "Out of Home or Online Media Owner",
                          "Search & Social Agency",
                        ],
                        type: "number",
                        enum: [22, 28, 40, 47],
                        title: "Company Type",
                      },
                      companyTypeProduction: {
                        enumNames: [
                          "Animation, Illustration, CGI and 3D Services",
                          "Design Agency/Studio",
                          "Digital Production",
                          "Editing",
                          "Film Production",
                          "Freelance / Individual",
                          "Music & Sound Production",
                          "Photography",
                          "Product Design",
                          "Radio Production",
                        ],
                        type: "number",
                        enum: [5, 16, 18, 20, 25, 28, 37, 41, 43, 44],
                        title: "Company Type",
                      },
                      agencyNetwork: {
                        enumNames: [
                          "ALL OTHER COMPANIES\r\n",
                          "ASATSU-DK\r\n",
                          "BARTLE BOGLE HEGARTY",
                          "BBDO WORLDWIDE",
                          "BLUE 449\r\n",
                          "BLUEFOCUS COMMUNICATION GROUP\r\n",
                          "BPN",
                          "CARAT\r\n",
                          "CDM GROUP",
                          "CHEIL WORLDWIDE\r\n",
                          "CMG",
                          "DAS",
                          "DDB HEALTHCARE GROUP\r\n",
                          "DDB WORLDWIDE",
                          "DENTSU",
                          "DENTSU X\r\n",
                          "DIGITASLBI\r\n",
                          "ENERO\r\n",
                          "FALLON WORLDWIDE\r\n",
                          "FCB",
                          "FCB HEALTH\r\n",
                          "GEOMETRY GLOBAL\r\n",
                          "GREY",
                          "GREY HEALTHCARE GROUP\r\n",
                          "GROUPM",
                          "GYRO\r\n",
                          "HAKUHODO",
                          "HAVAS HEALTH\r\n",
                          "HAVAS MEDIA GROUP\r\n",
                          "HAVAS WORLDWIDE\r\n",
                          "HEARTS & SCIENCE\r\n",
                          "HILL & KNOWLTON STRATEGIES\r\n",
                          "INITIATIVE",
                          "INVENTIV",
                          "ISOBAR\r\n",
                          "J. WALTER THOMPSON",
                          "KINETIC",
                          "LEO BURNETT",
                          "M&C SAATCHI\r\n",
                          "MAXUS",
                          "MCCANN HEALTH\r\n",
                          "MCCANN WORLDGROUP\r\n",
                          "MCGARRYBOWEN\r\n",
                          "MDC PARTNERS\r\n",
                          "MEC",
                          "MEDIACOM",
                          "MINDSHARE",
                          "MIXED OWNERSHIP\r\n",
                          "MSL GROUP\r\n",
                          "MULLENLOWE GROUP",
                          "OGILVY & MATHER",
                          "OGILVY COMMONHEALTH\r\n",
                          "OMD WORLDWIDE",
                          "PERFORMICS\r\n",
                          "PHD WORLDWIDE",
                          "POSSIBLE WORLDWIDE\r\n",
                          "POSTERSCOPE\r\n",
                          "PUBLICIS HEALTH\r\n",
                          "PUBLICIS WORLDWIDE",
                          "SAATCHI & SAATCHI",
                          "SAPIENTRAZORFISH\r\n",
                          "SCHOLZ & FRIENDS\r\n",
                          "SERVICEPLAN AGENTURGRUPPE\r\n",
                          "SPARK FOUNDRY\r\n",
                          "STARCOM\r\n",
                          "STW GROUP\r\n",
                          "SUDLER & HENNESSEY\r\n",
                          "TBWA WORLDWIDE",
                          "TBWA\\WORLDHEALTH\r\n",
                          "THE BLOCPARTNERS\r\n",
                          "THE BRAND UNION",
                          "THE NORTH ALLIANCE\r\n",
                          "THE UNITED NETWORK",
                          "THE&PARTNERSHIP\r\n",
                          "UM",
                          "VIZEUM\r\n",
                          "WIEDEN & KENNEDY\r\n",
                          "WUNDERMAN HEALTH\r\n",
                          "YOUNG & RUBICAM GROUP",
                          "ZENITH\r\n",
                        ],
                        type: "number",
                        enum: [
                          110,
                          4,
                          6,
                          8,
                          82,
                          83,
                          9,
                          84,
                          10,
                          13,
                          11,
                          15,
                          85,
                          16,
                          17,
                          18,
                          19,
                          86,
                          108,
                          22,
                          87,
                          27,
                          25,
                          88,
                          26,
                          89,
                          28,
                          30,
                          31,
                          32,
                          111,
                          33,
                          35,
                          36,
                          90,
                          38,
                          40,
                          42,
                          43,
                          45,
                          91,
                          52,
                          92,
                          46,
                          47,
                          48,
                          49,
                          1,
                          50,
                          51,
                          53,
                          94,
                          54,
                          97,
                          57,
                          60,
                          96,
                          95,
                          58,
                          64,
                          98,
                          67,
                          68,
                          100,
                          70,
                          65,
                          99,
                          71,
                          101,
                          104,
                          72,
                          103,
                          73,
                          102,
                          74,
                          106,
                          79,
                          107,
                          80,
                          81,
                        ],
                        title: "Agency Network",
                      },
                      holdingCompany: {
                        enumNames: [
                          "ALL OTHER COMPANIES\r\n",
                          "BLUEFOCUS COMMUNICATION GROUP\r\n",
                          "DENTSU GROUP\r\n",
                          "ENERO\r\n",
                          "HAKUHODO DY HOLDINGS\r\n",
                          "HAVAS GROUP\r\n",
                          "INTERPUBLIC GROUP\r\n",
                          "MDC PARTNERS\r\n",
                          "MIXED OWNERSHIP\r\n",
                          "OMNICOM\r\n",
                          "PUBLICIS GROUPE\r\n",
                          "WPP",
                        ],
                        type: "number",
                        enum: [10, 15, 3, 16, 5, 6, 7, 8, 17, 9, 12, 14],
                        title: "Holding Company",
                      },
                    },
                    required: [
                      "companyTypeAdvertiser",
                      "companyTypeAgency",
                      "companyTypeGovernment",
                      "companyTypeMedia",
                      "companyTypeProduction",
                      "agencyNetwork",
                      "holdingCompany",
                    ],
                  },
                },
              },
              address1: {
                maxLength: "250",
                type: "string",
                title: "Address",
              },
              address2: {
                maxLength: "250",
                type: "string",
                title: " ",
              },
              city: {
                maxLength: "40",
                type: "string",
                title: "City",
              },
              postcode: {
                maxLength: "20",
                type: "string",
                title: "Postcode/ZIP",
              },
              sanctionMessages: {
                properties: {
                  warn: {
                    type: "string",
                    title: " ",
                  },
                },
                type: "object",
                title: "",
              },
              switchboardPhone: {
                maxLength: "30",
                type: "string",
                title: "Main Switchboard",
              },
              directLine: {
                pattern: "[+]?[^+]",
                maxLength: "30",
                type: "string",
                title: "Direct Line",
              },
              mobilePhone: {
                maxLength: "30",
                type: "string",
                title: "Mobile",
              },
              assistantName: {
                maxLength: "100",
                type: "string",
                title: "Assistant's Name",
              },
              assistantEmail: {
                maxLength: "320",
                type: "string",
                title: "Assistant's Email",
                format: "email",
              },
              socialInstagram: {
                maxLength: "250",
                type: "string",
                title: "Instagram Handle",
              },
              socialTwitter: {
                maxLength: "250",
                type: "string",
                title: "Twitter Handle",
              },
              acceptTerms: {
                default: false,
                type: "boolean",
                title:
                  "I hereby accept my appointment as a member of the 2018 Jury as well as all conditions relevant to this position as stated in the invitation letter. I also hereby confirm that the details above are correct to be published in press releases and official Festival literature (contact details will not be given out to third parties). I understand that once I save this information it will be locked and uneditable.",
              },
              notice: {
                type: "string",
                title: " ",
              },
            },
            type: "object",
          },
        },
        status: "incomplete",
        schemaType: "delegateInformation",
        id: "05998FC5-F8D4-E711-99AF-22000A4AA935",
        userData: {
          emailAddress: "",
          noName: false,
          mobilePhone: "+",
          companyWebsiteAddress: "",
          directLine: "+ASas",
          socialTwitter: "asd",
          address2: "",
          assistantName: "asdas",
          socialInstagram: "",
          nameForPass: "",
          address1: "aS",
          companyName: "",
          jobTitle: "as",
          firstName: "",
          city: "as",
          companyData: {
            activitySubsection: {
              holdingCompany: "",
              agencyNetwork: 4,
              companyTypeAgency: 9,
            },
            companyActivity: 4,
          },
          secondName: "aS",
          geographicalRegion: {
            geographicalRegion_other: {
              geographicalRegion_other_sub: "",
            },
            geographicalRegion_sub: 6,
          },
          switchboardPhone: "+",
          title: 5,
          postcode: "aS",
          socialLinkedin: "",
          acceptTerms: false,
          festivalRepresentativesContact: false,
        },
      };

      const expected = {
        emailAddress: "",
        noName: false,
        mobilePhone: "+",
        directLine: "+ASas",
        socialTwitter: "asd",
        assistantName: "asdas",
        address1: "aS",
        companyName: "",
        jobTitle: "as",
        firstName: "",
        city: "as",
        companyData: {
          activitySubsection: {
            holdingCompany: "",
            agencyNetwork: 4,
            companyTypeAgency: 9,
          },
          companyActivity: 4,
        },
        secondName: "aS",
        geographicalRegion: {
          geographicalRegion_other: {
            geographicalRegion_other_sub: "",
          },
          geographicalRegion_sub: 6,
        },
        switchboardPhone: "+",
        title: 5,
        postcode: "aS",
        acceptTerms: false,
        festivalRepresentativesContact: false,
      };

      it("should return expected user data", () => {
        expect(filterEmptyValues(data.userData, data.form.schema)).eql(
          expected
        );
      });
    });

    describe("Filter correctly for multiple uploads", () => {
      const data = {
        form: {
          uiSchema: {
            pressUploads: {
              "ui:field": "multipleUpload",
              "ui:options": {
                uploadType: 5,
                url:
                  "https://app.filespin.io/api/v1/upload?upload_key=0e9dcb4cc95b4f448c3e8013f23aaef9&picker_host=app.filespin.io",
                types: ["image/jpeg", "image/png", "application/pdf"],
                description:
                  "<h3>General Terms</h3><p>eurobest press accreditation is strictly reserved for editorial team members (editors, journalists, reporters, photographers, broadcasters) and full-time freelancers (with evidence of at least six months experience with the publication).</p><p>Please ensure that you can provide the following:</p><ul><li>Copy of valid 2016/2017 press card</li><li>Commissioning letter on company letterhead outlining intended coverage (must be signed by and include the direct contact details for Editor-in-Chief)</li><li>Recent by-lined coverage of industry related articles (no more than one month old - returning media should also provide 2016 Festival coverage)</li><li>Copy of editorial masthead listing your name as an editorial contributor or link to an official author page</li><li>Acceptance of our Code of Conduct</li><li>Links to online presence: LinkedIn, Twitter, Personal website</li></ul>",
                method: "POST",
              },
            },
          },
          schema: {
            required: [],
            properties: {
              pressUploads: {
                title: "Document Upload",
                type: "array",
                minItems: 1,
                maxLength: 3,
                items: {
                  properties: {
                    filename: {
                      type: "string",
                    },
                    path: {
                      type: "string",
                    },
                    id: {
                      type: "string",
                    },
                  },
                  type: "object",
                },
              },
            },
            type: "object",
          },
        },
        status: "incomplete",
        schemaType: "pressUploads",
        id: "E15D5D10-7BA7-E711-99AF-22000A4AA935",
        userData: {
          pressUploads: [],
        },
      };

      const expected = {
        pressUploads: [],
      };

      it("should return expected user data", () => {
        expect(filterEmptyValues(data.userData, data.form.schema)).eql(
          expected
        );
      });
    });
  });
});
