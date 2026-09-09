import { Injectable } from '@nestjs/common';
import { VendorConnectorBase } from '../vendors/vendor-connector.base';
import { X12GeneratorService } from '../x12/x12-generator.service';
@Injectable()
export class ChangeHealthcareConnector extends VendorConnectorBase {
 public override readonly provider='change-healthcare';
 protected override get displayName(){return 'Change Healthcare / Optum';}
 protected override get patientPrefix(){return 'Change';}
 protected override get mrnPrefix(){return 'CHARN';}

}
