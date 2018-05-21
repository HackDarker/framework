
cc.Class({
    extends: cc.Component,

    properties: {
        planet: {
            default: null,
            type: cc.Node
        },
        spaceShip: {
            default: null,
            type: cc.Node
        },
        speed: -1,
        direction: 1,
    },

    // LIFE-CYCLE CALLBACKS:

    // onLoad () {},

    start() {
        this.spaceShip.x = this.planet.x + 200;
        this.spaceShip.y = this.planet.y;

        this.rotateAandB(this.spaceShip, this.planet);
    },

    rotateAandB(nodeA, nodeB) {
        this.ctx = this.planet.getComponent(cc.Graphics);
        if (!this.ctx) {
            this.ctx = new _ccsg.GraphicsNode();
            this.planet._sgNode.addChild(this.ctx);
            // this.ctx.moveTo(this.planet.x + this.planet.width / 2, this.planet.y + this.planet.height / 2);
            // this.ctx.lineTo(200, 0);
            // this.ctx.lineWidth = 5;
            // this.ctx.strokeColor = cc.hexToColor('#FF0000');
            // this.ctx.stroke();
        }

        var deg = -90;
        let R = Math.sqrt(Math.pow(nodeA.x - nodeB.x, 2) + Math.pow(nodeA.y - nodeB.y, 2));
        setInterval(() => {
            var ret = this.round(R, deg);
            nodeA.position = ret
            deg += 1
        }, 50)
    },
    round(r, detal) {
        return cc.v2({ x: Math.sin(detal * Math.PI / 180) * r * -this.direction, y: Math.cos(detal * Math.PI / 180) * r * this.direction });
    },

    update(dt) {

    },
});
