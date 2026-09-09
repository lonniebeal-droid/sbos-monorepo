import { Injectable } from '@nestjs/common';
import { VendorConnectorBase } from './vendor-connector.base';
@Injectable()
export class GenericHL7V2Connector extends VendorConnectorBase { public override readonly provider='generic-hl7-v2'; }
