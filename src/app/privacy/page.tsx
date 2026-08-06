import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import {
  LegalDoc,
  LegalEffectiveDate,
  LegalGeneratorNote,
  LegalLink,
  LegalList,
  LegalMail,
  LegalSection,
} from "@/components/LegalDoc";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How the Midland Meetups application collects, uses, shares, and retains your personal data, and the rights you have over it.",
};

const EFFECTIVE_DATE = "2026-08-06";

export default function PrivacyPage() {
  return (
    <LegalDoc>
      <PageHeader
        kicker="The fine print"
        title="Privacy Policy"
        lede="This privacy policy applies to the MidlandMeetups app for mobile devices, together with any related services operated by OneClickStack (collectively, the “Application”). OneClickStack is hereby referred to as the “Service Provider”."
      />

      <LegalSection title="Information Collection and Use">
        <p>
          The Application collects information when you download and use it. This
          information may include information such as
        </p>
        <LegalList>
          <li>Your device&apos;s Internet Protocol address</li>
          <li>
            The pages of the Application that you visit, the time and date of your
            visit, the time spent on those pages
          </li>
          <li>The time spent on the Application</li>
          <li>your mobile operating system you use</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Cookies and tracking technologies">
        <p>
          The Application or its third-party SDKs may use cookies, SDKs, pixels, and
          similar technologies to support functionality, analytics, or service
          delivery. Where required by applicable law, the Service Provider will
          obtain consent before using non-essential tracking technologies.
        </p>
      </LegalSection>

      <LegalSection title="Your Rights">
        <p>
          You may request access to, correction of, or deletion of your personal data
          held by the Service Provider. To exercise these rights, or to withdraw
          consent where processing is based on consent, contact the Service Provider
          at <LegalMail />.
        </p>
      </LegalSection>

      <LegalSection title="Your California privacy rights (CCPA/CPRA)">
        <p>
          If you are a California resident, you have the right to know what personal
          information is collected, the right to delete personal information, the
          right to opt out of the sale or sharing of personal information, and the
          right to non-discrimination for exercising these rights. To exercise your
          CCPA/CPRA rights, contact the Service Provider at <LegalMail />.
        </p>
      </LegalSection>

      <LegalSection>
        <p>
          The Service Provider may use the information you provide to send important
          information, required notices, and, where permitted by law, marketing
          communications.
        </p>
        <p>
          For a better experience while using the Application, the Service Provider
          may require you to provide certain personally identifiable information. The
          information the Service Provider requests will be retained and used as
          described in this privacy policy.
        </p>
      </LegalSection>

      <LegalSection title="Third Party Access">
        <p>
          Only aggregated, anonymized data is periodically transmitted to external
          services to aid the Service Provider in improving the Application and their
          service. The Service Provider may share your information with third parties
          in the ways that are described in this privacy statement.
        </p>
      </LegalSection>

      <LegalSection title="International Data Transfers">
        <p>
          The Service Provider or its third-party service providers may transfer
          personal data to countries outside your country of residence, including
          outside the European Economic Area (EEA). Where applicable law requires
          safeguards for international transfers, the Service Provider will use
          appropriate mechanisms.
        </p>
        <LegalList>
          <li>
            Standard Contractual Clauses (SCCs) approved by the European Commission
          </li>
          <li>
            Adequacy decisions or other legally recognized transfer mechanisms
          </li>
          <li>Your consent, where required and legally permitted</li>
        </LegalList>
        <p>
          Data protection laws in other countries may differ from those in your
          jurisdiction. Where required by law, the Service Provider will apply
          appropriate safeguards and obtain any consent required for the transfer.
        </p>
      </LegalSection>

      <LegalSection>
        <p>
          Please note that the Application utilizes third-party services that have
          their own Privacy Policy about handling data. Below are the links to the
          Privacy Policy of the third-party service providers used by the
          Application:
        </p>
        <LegalList>
          <li>
            <LegalLink href="https://firebase.google.com/support/privacy">
              Google Analytics for Firebase
            </LegalLink>
          </li>
          <li>
            <LegalLink href="https://firebase.google.com/support/privacy/">
              Firebase Crashlytics
            </LegalLink>
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection>
        <p>
          The Service Provider may disclose User Provided and Automatically Collected
          Information:
        </p>
        <LegalList>
          <li>
            as required by law, such as to comply with a subpoena, or similar legal
            process;
          </li>
          <li>
            when they believe in good faith that disclosure is necessary to protect
            their rights, protect your safety or the safety of others, investigate
            fraud, or respond to a government request;
          </li>
          <li>
            with their trusted services providers who work on their behalf, do not
            have an independent use of the information the Service Provider discloses
            to them, and have agreed to adhere to the rules set forth in this privacy
            statement.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Opt-Out Rights">
        <p>
          You can stop further collection of information from your mobile device by
          uninstalling the Application. Uninstalling will stop the Application from
          collecting data from your device, but it does not automatically delete
          information that has already been transmitted to the Service Provider or to
          third parties.
        </p>
        <p>
          To request deletion of your personal data, to withdraw consent, or to
          exercise any of your rights, contact the Service Provider at{" "}
          <LegalMail />.
        </p>
      </LegalSection>

      <LegalSection title="Data Retention Policy">
        <p>
          The Service Provider retains personal data based on its necessity for the
          stated purposes:
        </p>
        <LegalList>
          <li>
            User Provided Data: Retained for the duration of your use of the
            Application plus 12 months thereafter, unless longer retention is
            required by law
          </li>
          <li>
            Automatically Collected Data: Retained for up to 24 months from
            collection, unless longer retention is required for legal compliance
          </li>
          <li>
            Aggregated and Anonymized Data: Retained indefinitely as it no longer
            identifies you
          </li>
          <li>
            Data required for legal compliance: Retained as long as required by
            applicable law
          </li>
        </LegalList>
        <p>
          You may request deletion of your personal data, subject to any legal
          obligation to retain it. If you want the Service Provider to delete User
          Provided Data submitted through the Application, please contact them at{" "}
          <LegalMail />. Please note that some User Provided Data may be required for
          the Application to function properly.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          The Application is not intended for children under 16 years of age, or such
          higher age as required by applicable law. The Service Provider does not
          knowingly solicit data from children or market the Application to them.
        </p>
        <p>
          Where parental or guardian consent is required under applicable law, the
          Application is not intended for use without that consent. The Service
          Provider does not knowingly collect personally identifiable information
          from children under 16 years of age in violation of applicable law. In the
          event the Service Provider discovers that a child has provided personal
          information, the Service Provider will immediately delete this from their
          servers. If you are a parent or guardian and you are aware that your child
          has provided the Service Provider with personal information, please contact
          the Service Provider (<LegalMail />) so that they will be able to take the
          necessary actions.
        </p>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          The Service Provider is concerned about safeguarding the confidentiality of
          your information. The Service Provider provides physical, electronic, and
          procedural safeguards to protect information the Service Provider processes
          and maintains.
        </p>
      </LegalSection>

      <LegalSection title="Data Breach Notification">
        <p>
          If a data breach occurs that affects your personal data, the Service
          Provider will notify you in accordance with applicable legal requirements,
          including, where required, providing information about the nature of the
          breach and the steps being taken to address it.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          The Service Provider may update this Privacy Policy from time to time. The
          Service Provider will notify you of material changes by posting the updated
          Privacy Policy with an effective date. Where required by law, the Service
          Provider will seek your consent to material changes before they take
          effect.
        </p>
        <p>
          Previous versions of this Privacy Policy will be maintained and made
          available upon request by contacting the Service Provider at <LegalMail />.
        </p>
      </LegalSection>

      <LegalEffectiveDate>
        This privacy policy is effective as of {EFFECTIVE_DATE}
      </LegalEffectiveDate>

      <LegalSection title="Your Consent">
        <p>
          Where processing is based on consent, you provide that consent by
          affirmatively opting in to the relevant feature or action. You may withdraw
          consent at any time without affecting processing carried out before
          withdrawal. Processing based on other lawful bases is carried out as
          described above.
        </p>
      </LegalSection>

      <LegalSection title="Contact Us">
        <p>
          If you have any questions regarding privacy while using the Application, or
          have questions about the practices, please contact the Service Provider via
          email at <LegalMail />.
        </p>
      </LegalSection>

      <LegalGeneratorNote>
        This privacy policy page was generated by{" "}
        <LegalLink href="https://app-privacy-policy-generator.nisrulz.com/">
          App Privacy Policy Generator
        </LegalLink>
      </LegalGeneratorNote>
    </LegalDoc>
  );
}
