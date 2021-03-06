import { Component, OnInit } from '@angular/core';
import { HasLayoutSettings, LayoutSettings } from '../../layout';
import { Configuration } from '../../../model';
import { AuthenticationService, ConfigsService, ModalService } from '../../../services';
import { ViewUtils } from '../../../common';
import { Router, ActivatedRoute } from '@angular/router';
import { DropdownMenuSettings, NotificationsService } from 'argo-ui-lib/src/components';

@Component({
    selector: 'ax-config-management-overview',
    templateUrl: './config-management-overview.html',
    styles: [ require('./config-management-overview.scss') ]
})

export class ConfigManagementOverviewComponent implements OnInit, HasLayoutSettings, LayoutSettings {

    public configurations: Configuration[] = [];
    public loading: boolean;
    public selectedConfig: Configuration;
    public currentUser: string;
    public create: boolean;

    private showMyOnly: boolean;

    constructor(
        private router: Router,
        private activatedRoute: ActivatedRoute,
        private authenticationService: AuthenticationService,
        private configsService: ConfigsService,
        private modalService: ModalService,
        private notificationsService: NotificationsService,
    ) {}

    public ngOnInit() {
        this.currentUser = this.authenticationService.getUsername();
        this.activatedRoute.params.subscribe(async params => {
            let edit = params['edit'] || '';
            this.create = false;
            if (edit) {
                let [user, name]: [string, string] = edit.split(':');
                let configs = await this.configsService.getConfigurations({ user, name }, true);
                this.selectedConfig = configs[0];
            } else if (params['createNew'] === 'true') {
                this.selectedConfig = {};
                this.create = true;
            } else {
                this.selectedConfig = null;
            }

            let showMyOnly = params['showMyOnly'] === 'true' ? true : false;
            if (this.showMyOnly !== showMyOnly) {
                this.toolbarFilters.model = params['showMyOnly'] === 'true' ? ['myown'] : [];
                this.showMyOnly = showMyOnly;
                this.loadConfigurations();
            }
        });
    }

    public get layoutSettings(): LayoutSettings {
        return this;
    }

    public pageTitle = 'Configurations';

    public get globalAddAction() {
        return () => {
            this.router.navigate(['/app/config-management', ViewUtils.sanitizeRouteParams(this.getRouteParams(), { createNew: 'true' })], { relativeTo: this.activatedRoute });
        };
    }

    public getPanelMode(config: Configuration) {
        if (this.create) {
            return 'create';
        } else if (config && this.currentUser === config.user) {
            return 'edit';
        } else {
            return 'view';
        }
    }

    public toolbarFilters = {
        data: [{
            name: 'My Configurations',
            value: 'myown',
        }],
        model: [],
        onChange: () => {
            this.router.navigate(['/app/config-management',
                ViewUtils.sanitizeRouteParams(this.getRouteParams(), { showMyOnly: !this.showMyOnly })], { relativeTo: this.activatedRoute });
        }
    };

    public async loadConfigurations() {
        this.loading = true;
        this.configurations = await this.configsService.getConfigurations({ user: this.showMyOnly ? this.currentUser : null });
        this.configurations.sort( (a, b) => {
           if ((a.user === this.currentUser) && (b.user !== this.currentUser)) {
               return -1;
            } else if ((a.user !== this.currentUser) && (b.user === this.currentUser)) {
                return 1;
            } else {
                if (a.ctime >  b.ctime) {
                    return -1;
                } else {
                    return 1;
                }
            }
        });
        this.loading = false;
    }

    public getDropdownMenu(config) {
        if (config.user === this.currentUser) {
            return new DropdownMenuSettings([{
                title: 'Edit',
                iconName: 'fa fa-pencil-square-o',
                action: () => this.editSelectedConfig(config)
            }, {
                title: 'Delete',
                iconName: 'fa-times-circle-o',
                action: () => this.deleteConfig(config)
            }]);
        } else {
            return new DropdownMenuSettings([{
                title: 'Read',
                iconName: 'fa fa-book',
                action: () => this.editSelectedConfig(config)
            }]);
        }
    }

    public editSelectedConfig(config: Configuration) {
        this.router.navigate([
            '/app/config-management', ViewUtils.sanitizeRouteParams(this.getRouteParams(), { edit: `${config.user}:${config.name}` })], { relativeTo: this.activatedRoute });
    }

    public async deleteConfig(config: Configuration) {
        this.modalService.showModal('Delete configuration', `Are you sure you want to delete configuration '${config.name}'`).subscribe(async confirmed => {
            if (confirmed) {
                await this.configsService.deleteConfiguration( {user: this.currentUser, name: config.name} );
                this.notificationsService.success('Configuration has been deleted successfully.');
                this.loadConfigurations();
            }
        });
    }

    public closePanel() {
        this.router.navigate([
            '/app/config-management', ViewUtils.sanitizeRouteParams(this.getRouteParams(), { createNew: false, edit: null })], { relativeTo: this.activatedRoute });
    }

    public async saveConfigChange(config: Configuration) {
        config = Object.assign(config, { user: this.currentUser });
        if (this.create) {
            await this.configsService.createConfiguration(config);
            this.notificationsService.success('Configuration has been created successfully.');
        } else {
            await this.configsService.updateConfiguration(config);
            this.notificationsService.success('Configuration has been updated successfully.');
        }
        this.loadConfigurations();
        this.closePanel();
    }

    private getRouteParams() {
        return { showMyOnly: this.showMyOnly.toString() };
    }
}
